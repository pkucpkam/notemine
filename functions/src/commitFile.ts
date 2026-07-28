import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretClient = new SecretManagerServiceClient();

async function getGitHubToken(): Promise<string> {
  const projectId = process.env.GCLOUD_PROJECT;
  const name = `projects/${projectId}/secrets/github-token/versions/latest`;
  const [version] = await secretClient.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload) throw new Error('GitHub token not found in Secret Manager');
  return payload;
}

interface CommitFileData {
  repo: string;        // "owner/repo"
  path: string;        // "docs/a.md"
  content: string;     // new markdown content
  message?: string;    // commit message (optional)
  sha: string;         // blob sha of the current file
  branch?: string;     // defaults to "main"
}

export const commitFile = onCall(
  {
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { repo, path, content, message, sha, branch = 'main' } = request.data as CommitFileData;

    if (!repo || !path || !content || !sha) {
      throw new HttpsError('invalid-argument', 'Missing required fields: repo, path, content, sha');
    }

    const [owner, repoName] = repo.split('/');
    const token = await getGitHubToken();
    const commitMessage = message || `docs: update ${path}`;
    const encodedContent = Buffer.from(content, 'utf-8').toString('base64');

    // GitHub Contents API — update file
    const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'NoteMine/1.0',
      },
      body: JSON.stringify({
        message: commitMessage,
        content: encodedContent,
        sha,
        branch,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new HttpsError('internal', `GitHub API error: ${err}`);
    }

    const result = await response.json() as any;
    const newSha: string = result.content?.sha || sha;

    // Immediately update Firestore so UI reflects new content
    const db = admin.firestore();
    const docId = `${repo.replace('/', '__')}__${path.replace(/\//g, '__')}`;

    // Parse frontmatter and extract title for Firestore update
    await db.collection('docs').doc(docId).update({
      content,
      sha: newSha,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, sha: newSha };
  }
);
