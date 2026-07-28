import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { graphql } from '@octokit/graphql';
import * as matter from 'gray-matter';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// GitHub repos to sync — match your client-side config
const REPOS_TO_SYNC: Array<{ owner: string; repo: string; branch: string }> = [
  // Example: { owner: 'pkucpkam', repo: 'notes', branch: 'main' },
  // Add your repos here
];

const secretClient = new SecretManagerServiceClient();

async function getGitHubToken(): Promise<string> {
  const projectId = process.env.GCLOUD_PROJECT;
  const name = `projects/${projectId}/secrets/github-token/versions/latest`;
  const [version] = await secretClient.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload) throw new Error('GitHub token not found in Secret Manager');
  return payload;
}

function extractTitle(content: string, frontmatter: Record<string, unknown>): string {
  // Try frontmatter title first
  if (frontmatter.title && typeof frontmatter.title === 'string') {
    return frontmatter.title;
  }
  // Try first H1
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return '';
}

interface Heading {
  level: number;
  text: string;
  anchor: string;
}

function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const anchor = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    headings.push({ level, text, anchor });
  }
  return headings;
}

function slugify(repo: string, path: string): string {
  return `${repo.replace('/', '__')}__${path.replace(/\//g, '__')}`;
}

// Query all markdown files from a repo via GraphQL
const TREE_QUERY = `
  query GetTree($owner: String!, $repo: String!, $expression: String!) {
    repository(owner: $owner, name: $repo) {
      object(expression: $expression) {
        ... on Tree {
          entries {
            name
            path
            type
            object {
              ... on Blob {
                text
                oid
              }
            }
          }
        }
      }
    }
  }
`;

// Recursive file fetch via GraphQL (returns all .md files)
async function fetchAllMarkdownFiles(
  octokit: typeof graphql,
  owner: string,
  repo: string,
  branch: string,
  path = ''
): Promise<Array<{ path: string; content: string; sha: string }>> {
  const expression = path
    ? `${branch}:${path}`
    : `${branch}:`;

  const { repository } = await octokit(TREE_QUERY, {
    owner,
    repo,
    expression,
  }) as any;

  const entries = repository?.object?.entries || [];
  const files: Array<{ path: string; content: string; sha: string }> = [];

  for (const entry of entries) {
    if (entry.type === 'blob' && entry.name.endsWith('.md')) {
      files.push({
        path: entry.path,
        content: entry.object?.text || '',
        sha: entry.object?.oid || '',
      });
    } else if (entry.type === 'tree') {
      const nested = await fetchAllMarkdownFiles(octokit, owner, repo, branch, entry.path);
      files.push(...nested);
    }
  }

  return files;
}

export const syncRepo = onCall(
  {
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (request) => {
    // Verify auth
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const db = admin.firestore();

    // Update sync status
    await db.collection('syncMeta').doc('status').set({
      lastSyncStatus: 'syncing',
      lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    try {
      const token = await getGitHubToken();
      const octokit = graphql.defaults({
        headers: {
          authorization: `token ${token}`,
        },
      });

      let totalSynced = 0;

      for (const { owner, repo, branch } of REPOS_TO_SYNC) {
        const repoKey = `${owner}/${repo}`;
        console.log(`Syncing ${repoKey}...`);

        const files = await fetchAllMarkdownFiles(octokit, owner, repo, branch);
        console.log(`Found ${files.length} markdown files in ${repoKey}`);

        const batch = db.batch();
        let batchCount = 0;

        for (const file of files) {
          const parsed = matter.default(file.content);
          const rawContent = parsed.content;
          const frontmatter = parsed.data as Record<string, unknown>;
          const title = extractTitle(rawContent, frontmatter);
          const headings = extractHeadings(rawContent);
          const docId = slugify(repoKey, file.path);

          const docRef = db.collection('docs').doc(docId);
          batch.set(docRef, {
            repo: repoKey,
            path: file.path,
            title,
            content: rawContent,
            headings,
            frontmatter,
            sha: file.sha,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          batchCount++;
          totalSynced++;

          // Firestore batch limit is 500 writes
          if (batchCount >= 499) {
            await batch.commit();
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        console.log(`Synced ${files.length} files from ${repoKey}`);
      }

      // Update success status
      await db.collection('syncMeta').doc('status').set({
        lastSyncStatus: 'success',
        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return { success: true, totalSynced };
    } catch (error) {
      console.error('Sync error:', error);
      await db.collection('syncMeta').doc('status').set({
        lastSyncStatus: 'error',
        lastSyncError: String(error),
        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      throw new HttpsError('internal', `Sync failed: ${String(error)}`);
    }
  }
);
