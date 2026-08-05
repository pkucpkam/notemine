import { doc, setDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getGitHubToken } from './github-token';
import { GITHUB_REPOS } from './config';
import type { DraftEntry } from './firestore';


export interface GitHubFile {
  path: string;
  content: string;
  sha: string;
}

// GitHub REST API — lấy toàn bộ file .md trong repo
async function fetchRepoFiles(
  owner: string,
  repo: string,
  targetBranch: string,
  token: string
): Promise<GitHubFile[]> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };

  let activeBranch = targetBranch;

  // Lấy cây file qua REST API (tree recursive)
  let treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${activeBranch}?recursive=1`,
    { headers }
  );

  // Nếu 404, kiểm tra xem repo có tồn tại không hoặc branch có phải master/main khác không
  if (treeRes.status === 404) {
    const repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoInfoRes.ok) {
      if (repoInfoRes.status === 404) {
        throw new Error(`Repo ${owner}/${repo} không tồn tại hoặc GitHub PAT chưa được cấp quyền đọc repo private này.`);
      }
      throw new Error(`Lỗi kiểm tra repo (${repoInfoRes.status}): ${await repoInfoRes.text()}`);
    }

    const repoData = await repoInfoRes.json() as { default_branch?: string };
    if (repoData.default_branch && repoData.default_branch !== activeBranch) {
      activeBranch = repoData.default_branch;
      treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${activeBranch}?recursive=1`,
        { headers }
      );
    }
  }

  if (!treeRes.ok) {
    const errText = await treeRes.text();
    throw new Error(`Lỗi đọc repo ${owner}/${repo} (branch: ${activeBranch}, status ${treeRes.status}): ${errText}`);
  }

  const treeData = await treeRes.json() as {
    tree: Array<{ path: string; type: string; sha: string; url: string }>;
  };

  const mdFiles = (treeData.tree || []).filter(
    (f) => f.type === 'blob' && f.path.endsWith('.md')
  );

  // Fetch nội dung từng file song song (batch 10)
  const files: GitHubFile[] = [];
  for (let i = 0; i < mdFiles.length; i += 10) {
    const batch = mdFiles.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (f) => {
        const blobRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/blobs/${f.sha}`,
          { headers }
        );
        if (!blobRes.ok) return null;
        const blob = await blobRes.json() as { content: string; encoding: string };
        let content = blob.content;
        if (blob.encoding === 'base64') {
          try {
            const cleanBase64 = blob.content.replace(/\s/g, '');
            const bytes = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
            content = new TextDecoder('utf-8').decode(bytes);
          } catch {
            content = atob(blob.content.replace(/\s/g, ''));
          }
        }
        return { path: f.path, content, sha: f.sha } satisfies GitHubFile;
      })
    );
    files.push(...results.filter(Boolean) as GitHubFile[]);
  }

  return files;
}

function extractTitle(content: string, frontmatter: Record<string, unknown>): string {
  if (frontmatter.title && typeof frontmatter.title === 'string') return frontmatter.title;
  const h1 = content.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : '';
}

function parseFrontmatter(raw: string): { content: string; data: Record<string, unknown> } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { content: raw, data: {} };
  const data: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const [key, ...val] = line.split(':');
    if (key && val.length) data[key.trim()] = val.join(':').trim();
  }
  return { content: match[2], data };
}

function extractHeadings(content: string) {
  const headings: Array<{ level: number; text: string; anchor: string }> = [];
  for (const match of content.matchAll(/^(#{1,6})\s+(.+)$/gm)) {
    const text = match[2].trim();
    headings.push({
      level: match[1].length,
      text,
      anchor: text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'),
    });
  }
  return headings;
}

function slugify(repo: string, path: string): string {
  return `${repo.replace('/', '__')}__${path.replace(/\//g, '__')}`;
}

// Callback để hiển thị progress
export type SyncProgressCallback = (msg: string) => void;

export async function syncAllRepos(onProgress?: SyncProgressCallback): Promise<number> {
  const token = await getGitHubToken();
  if (!token) throw new Error('NO_TOKEN');

  if (GITHUB_REPOS.length === 0) throw new Error('NO_REPOS');

  let total = 0;

  for (const { owner, repo, branch } of GITHUB_REPOS) {
    const repoKey = `${owner}/${repo}`;
    onProgress?.(`Đang lấy ${repoKey}…`);

    const files = await fetchRepoFiles(owner, repo, branch, token);
    onProgress?.(`Tìm thấy ${files.length} file .md trong ${repoKey}`);

    // Ghi Firestore theo batch (max 500/batch)
    let batch = writeBatch(db);
    let count = 0;

    for (const file of files) {
      const { content, data: frontmatter } = parseFrontmatter(file.content);
      const title = extractTitle(content, frontmatter);
      const headings = extractHeadings(content);
      const docId = slugify(repoKey, file.path);

      batch.set(doc(db, 'docs', docId), {
        repo: repoKey,
        path: file.path,
        title: title || file.path.split('/').pop()?.replace('.md', '') || '',
        content,
        headings,
        frontmatter,
        sha: file.sha,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      count++;
      total++;

      if (count >= 499) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) await batch.commit();
    onProgress?.(`✓ Synced ${files.length} files từ ${repoKey}`);
  }

  // Update syncMeta
  await setDoc(doc(db, 'syncMeta', 'status'), {
    lastSyncStatus: 'success',
    lastSyncAt: serverTimestamp(),
  }, { merge: true });

  return total;
}

// Commit 1 file lên GitHub (cho Phase 2 editor)
export async function commitFileToGitHub(params: {
  repo: string; // "owner/repo"
  path: string;
  content: string;
  sha: string;
  message?: string;
  branch?: string;
}): Promise<string> {
  const token = await getGitHubToken();
  if (!token) throw new Error('NO_TOKEN');

  const { repo, path, content, sha, message = `docs: update ${params.path}`, branch = 'main' } = params;
  const [owner, repoName] = repo.split('/');

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message,
        content: btoa(unescape(encodeURIComponent(content))),
        sha,
        branch,
      }),
    }
  );

  if (!res.ok) throw new Error(`GitHub commit error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { content: { sha: string } };

  // Cập nhật ngay lập tức vào Firestore docs để UI phản hồi tức thì mà không cần đợi sync
  const { content: parsedContent, data: frontmatter } = parseFrontmatter(content);
  const title = extractTitle(parsedContent, frontmatter) || path.split('/').pop()?.replace('.md', '') || '';
  const headings = extractHeadings(parsedContent);
  const docId = slugify(repo, path);

  await setDoc(
    doc(db, 'docs', docId),
    {
      repo,
      path,
      title,
      content: parsedContent,
      headings,
      frontmatter,
      sha: data.content.sha,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return data.content.sha;
}

// Tạo file mới trên GitHub (không cần sha vì file chưa tồn tại)
export async function createFileOnGitHub(params: {
  repo: string; // "owner/repo"
  path: string;
  content: string;
  message?: string;
  branch?: string;
}): Promise<string> {
  const token = await getGitHubToken();
  if (!token) throw new Error('NO_TOKEN');

  const { repo, path, content, message = `docs: create ${params.path}`, branch = 'main' } = params;
  const [owner, repoName] = repo.split('/');

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message,
        content: btoa(unescape(encodeURIComponent(content))),
        branch,
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub create error: ${res.status} ${errText}`);
  }
  const data = await res.json() as { content: { sha: string } };
  return data.content.sha;
}

// Tạo thư mục trên GitHub bằng cách tạo file .gitkeep bên trong
export async function createFolderOnGitHub(params: {
  repo: string; // "owner/repo"
  folderPath: string; // e.g. "notes/my-folder"
  message?: string;
  branch?: string;
}): Promise<void> {
  const { repo, folderPath, message = `docs: create folder ${params.folderPath}`, branch = 'main' } = params;
  // GitHub không hỗ trợ tạo folder trống, phải tạo file bên trong
  await createFileOnGitHub({
    repo,
    path: `${folderPath}/.gitkeep`,
    content: '',
    message,
    branch,
  });
}

// Lấy danh sách branches của repo
export async function listRepoBranches(repo: string): Promise<string[]> {
  const token = await getGitHubToken();
  if (!token) throw new Error('NO_TOKEN');

  const [owner, repoName] = repo.split('/');
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/branches?per_page=50`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );
  if (!res.ok) throw new Error(`GitHub branches error: ${res.status}`);
  const data = await res.json() as Array<{ name: string }>;
  return data.map((b) => b.name);
}

export type UploadProgress = (msg: string) => void;

// Xóa 1 draft khỏi Firestore (không commit lên GitHub)
export async function deleteDraftFromFirestore(draftId: string): Promise<void> {
  await deleteDoc(doc(db, 'drafts', draftId));
}

/**
 * Upload tất cả drafts lên GitHub trong MỘT commit duy nhất.
 * Sử dụng Git Data API: tạo blobs → tạo tree → tạo commit → update ref.
 * Trả về danh sách { draftId, path, newSha } đã commit thành công.
 */
export async function uploadDraftsToGitHub(
  drafts: DraftEntry[],
  onProgress?: UploadProgress
): Promise<Array<{ draftId: string; path: string; newSha: string }>> {
  const token = await getGitHubToken();
  if (!token) throw new Error('NO_TOKEN');

  if (drafts.length === 0) throw new Error('NO_DRAFTS');

  const headers = {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github.v3+json',
  };

  // Gom các draft theo từng repo+branch
  type RepoGroup = { owner: string; repoName: string; branch: string; drafts: DraftEntry[] };
  const groups = new Map<string, RepoGroup>();
  for (const draft of drafts) {
    const [owner, repoName] = draft.repo.split('/');
    const branch = draft.branch || 'main';
    const key = `${owner}/${repoName}@${branch}`;
    if (!groups.has(key)) groups.set(key, { owner, repoName, branch, drafts: [] });
    groups.get(key)!.drafts.push(draft);
  }

  const results: Array<{ draftId: string; path: string; newSha: string }> = [];

  for (const { owner, repoName, branch, drafts: groupDrafts } of groups.values()) {
    const repoKey = `${owner}/${repoName}`;
    onProgress?.(`Chuẩn bị commit lên ${repoKey}…`);

    // 1. Lấy SHA của HEAD commit hiện tại
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${branch}`,
      { headers }
    );
    if (!refRes.ok) {
      throw new Error(`Không thể lấy ref branch ${branch}: ${refRes.status} ${await refRes.text()}`);
    }
    const refData = await refRes.json() as { object: { sha: string } };
    const baseCommitSha = refData.object.sha;

    // 2. Lấy tree SHA của commit đó
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseCommitSha}`,
      { headers }
    );
    if (!commitRes.ok) {
      throw new Error(`Không thể lấy commit ${baseCommitSha}: ${commitRes.status}`);
    }
    const commitData = await commitRes.json() as { tree: { sha: string } };
    const baseTreeSha = commitData.tree.sha;

    // 3. Tạo blobs song song cho tất cả file
    onProgress?.(`Đang tạo ${groupDrafts.length} blobs…`);
    const treeEntries: Array<{ path: string; mode: string; type: string; sha: string }> = [];
    const draftResults: Array<{ draftId: string; path: string; blobSha: string; content: string }> = [];

    await Promise.all(groupDrafts.map(async (draft) => {
      const isFolder = draft.type === 'folder';
      const filePath = isFolder ? `${draft.path}/.gitkeep` : draft.path;
      const rawContent = isFolder ? '' : (draft.content || `# ${draft.title}\n\n`);

      const blobRes = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/blobs`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: btoa(unescape(encodeURIComponent(rawContent))),
            encoding: 'base64',
          }),
        }
      );
      if (!blobRes.ok) {
        throw new Error(`Tạo blob cho ${filePath} thất bại: ${blobRes.status} ${await blobRes.text()}`);
      }
      const blob = await blobRes.json() as { sha: string };

      treeEntries.push({ path: filePath, mode: '100644', type: 'blob', sha: blob.sha });
      draftResults.push({ draftId: draft.id, path: draft.path, blobSha: blob.sha, content: rawContent });
    }));

    // 4. Tạo tree mới
    onProgress?.(`Đang tạo tree…`);
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
      }
    );
    if (!treeRes.ok) {
      throw new Error(`Tạo tree thất bại: ${treeRes.status} ${await treeRes.text()}`);
    }
    const treeData = await treeRes.json() as { sha: string };

    // 5. Tạo commit mới
    const fileNames = groupDrafts
      .filter((d) => d.type === 'document')
      .map((d) => d.path.split('/').pop() || d.path)
      .join(', ');
    const commitBody = fileNames || groupDrafts.map((d) => d.path).join(', ');
    const commitMessage = `notemine/add content\n\n${commitBody}`;

    onProgress?.(`Đang tạo commit…`);
    const newCommitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: commitMessage,
          tree: treeData.sha,
          parents: [baseCommitSha],
        }),
      }
    );
    if (!newCommitRes.ok) {
      throw new Error(`Tạo commit thất bại: ${newCommitRes.status} ${await newCommitRes.text()}`);
    }
    const newCommit = await newCommitRes.json() as { sha: string };

    // 6. Update branch ref
    onProgress?.(`Đang cập nhật branch ${branch}…`);
    const updateRefRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ sha: newCommit.sha, force: false }),
      }
    );
    if (!updateRefRes.ok) {
      throw new Error(`Cập nhật ref thất bại: ${updateRefRes.status} ${await updateRefRes.text()}`);
    }

    // 7. Cập nhật Firestore: chuyển draft → doc chính thức
    for (const dr of draftResults) {
      const { content: parsedContent, data: frontmatter } = parseFrontmatter(dr.content);
      const draftEntry = groupDrafts.find((d) => d.id === dr.draftId)!;
      const title = extractTitle(parsedContent, frontmatter)
        || draftEntry.title
        || dr.path.split('/').pop()?.replace('.md', '')
        || '';
      const headings = extractHeadings(parsedContent);
      const docId = slugify(repoKey, dr.path);

      await setDoc(
        doc(db, 'docs', docId),
        {
          repo: repoKey,
          path: dr.path,
          title,
          content: parsedContent,
          headings,
          frontmatter,
          sha: dr.blobSha,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await deleteDoc(doc(db, 'drafts', dr.draftId));
      results.push({ draftId: dr.draftId, path: dr.path, newSha: dr.blobSha });
    }

    onProgress?.(`✓ Đã commit ${groupDrafts.length} file lên ${repoKey}/${branch}`);
  }

  return results;
}

