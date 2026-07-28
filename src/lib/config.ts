// Firebase configuration
// Copy your Firebase project config here

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Whitelisted UID — only this user can access the app
export const ALLOWED_UID = import.meta.env.VITE_ALLOWED_UID || '';

// GitHub repos parsed from VITE_GITHUB_REPOS env var
// Format in .env: VITE_GITHUB_REPOS=owner/repo:branch,owner/repo2:main
export const GITHUB_REPOS: Array<{ owner: string; repo: string; branch: string }> =
  (import.meta.env.VITE_GITHUB_REPOS || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean)
    .map((entry: string) => {
      const [repoPath, branch = 'main'] = entry.split(':');
      const [owner, repo] = repoPath.split('/');
      return { owner, repo, branch };
    })
    .filter(({ owner, repo }: { owner: string; repo: string }) => owner && repo);

