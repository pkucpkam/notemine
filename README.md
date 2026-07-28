# NoteMine — Setup Guide

> Personal GitHub-backed markdown knowledge base. Notion-style design. React + Firebase + GitHub GraphQL.

---

## Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (free Spark plan is fine)
- A GitHub Fine-grained PAT

---

## Step 1 — Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (e.g., `notemine-personal`)
3. Enable **Firestore** (Native mode, any region)
4. Enable **Authentication** → Sign-in method → **GitHub**
   - You'll need to register a GitHub OAuth App at github.com/settings/developers
   - Callback URL: `https://your-project.firebaseapp.com/__/auth/handler`
5. In Project Settings → Your apps → Add Web app → copy the `firebaseConfig`

---

## Step 2 — Configure the App

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your values:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_ALLOWED_UID=    # Fill this AFTER first login (see Step 5)
```

---

## Step 3 — Add Your GitHub Repos

Edit [`src/lib/config.ts`](./src/lib/config.ts):

```ts
export const GITHUB_REPOS = [
  { owner: 'your-username', repo: 'your-notes', branch: 'main' },
  // Add more repos here
];
```

Also update `functions/src/syncRepo.ts` — the same `REPOS_TO_SYNC` array.

---

## Step 4 — Create GitHub Fine-grained PAT

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Create a new token:
   - **Repository access**: Select your specific notes repos only
   - **Permissions**: `Contents: Read-only` (for Phase 1), `Contents: Read and write` (for Phase 2 editor)
   - **Expiration**: 90 days (recommended)
3. Copy the token

---

## Step 5 — First Login & Get Your UID

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) → Sign in with GitHub.

Then go to **Firebase Console → Authentication → Users** → copy your UID.

Update `.env.local`:
```env
VITE_ALLOWED_UID=your-uid-from-firebase
```

Also update `firestore.rules` line 9:
```
return request.auth != null && request.auth.uid == "your-uid-here";
```

---

## Step 6 — Setup Cloud Functions

```bash
cd functions
npm install
cd ..
```

Login to Firebase CLI:
```bash
firebase login
firebase use your-project-id
```

---

## Step 7 — Store GitHub Token in Secret Manager

In **Google Cloud Console** (same project as Firebase):

```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Create the secret
echo -n "your-github-pat-token" | gcloud secrets create github-token --data-file=-

# Grant Cloud Functions access to the secret
gcloud secrets add-iam-policy-binding github-token \
  --member="serviceAccount:your-project@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Step 8 — Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

---

## Step 9 — Deploy Cloud Functions

```bash
firebase deploy --only functions
```

---

## Step 10 — Trigger First Sync

In the app (sidebar bottom) → click the **↻ sync** button.

Or call the function directly:
```bash
curl -X POST https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/syncRepo \
  -H "Authorization: Bearer $(firebase auth:export ...)"
```

---

## Local Development

```bash
npm run dev        # Start React app
firebase emulators:start   # Start Firebase emulators (Firestore + Functions)
```

---

## Deploy Everything

```bash
npm run build
firebase deploy
```

---

## Project Structure

```
notemine/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      # Main layout (sidebar + content)
│   │   │   └── Sidebar.tsx       # File tree + search + sync status
│   │   ├── FileTree.tsx          # Recursive tree navigation
│   │   ├── SearchBar.tsx         # Debounced full-text search
│   │   ├── MarkdownRenderer.tsx  # Notion-style MD rendering
│   │   └── SyncStatus.tsx        # Sync state indicator
│   ├── contexts/
│   │   ├── AuthContext.tsx       # Firebase Auth state
│   │   └── DocsContext.tsx       # Firestore docs + search index
│   ├── lib/
│   │   ├── firebase.ts           # Firebase init
│   │   ├── auth.ts               # GitHub sign-in + UID guard
│   │   ├── firestore.ts          # Firestore subscriptions
│   │   ├── search.ts             # Client-side full-text search
│   │   └── config.ts             # App config + repo list
│   ├── pages/
│   │   ├── LoginPage.tsx         # GitHub sign-in page
│   │   ├── HomePage.tsx          # Redirects to first doc
│   │   └── DocPage.tsx           # Markdown document viewer
│   └── styles/
│       ├── tokens.css            # Notion design tokens (from DESIGN.md)
│       └── global.css            # Global styles + Inter font
├── functions/
│   └── src/
│       ├── syncRepo.ts           # GitHub GraphQL → Firestore sync
│       └── commitFile.ts         # GitHub Contents API commit (Phase 2)
├── firestore.rules               # Deny-all, owner-only access
├── firebase.json                 # Firebase project config
└── DESIGN.md                     # Notion design system tokens
```

---

## Phase 2 — Editor (Coming Next)

When you're ready to enable editing:

1. Install CodeMirror: `npm install @codemirror/view @codemirror/state codemirror`
2. Add "Edit" button to `DocPage.tsx`
3. Call `commitFile` Cloud Function on save

---

## Security Notes

| Risk | Mitigation |
|------|-----------|
| GitHub token exposure | Stored in Google Secret Manager, never sent to client |
| Unauthorized access | Firestore rules + client UID guard |
| Too-broad GitHub scope | Fine-grained PAT, repo-specific, `contents` only |
| Token expiry | Set 90-day expiry + reminder to rotate |
