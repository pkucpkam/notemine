import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface DocEntry {
  id: string;
  repo: string;
  path: string;
  title: string;
  content: string;
  headings: Array<{ level: number; text: string; anchor: string }>;
  frontmatter: Record<string, unknown>;
  sha: string;
  updatedAt: Timestamp | null;
}

export interface SyncMeta {
  lastSyncAt: Timestamp | null;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncError?: string;
}

/** Draft entry — file/folder đã tạo nhưng chưa upload GitHub */
export interface DraftEntry {
  id: string;          // docId unique (thường là path-based)
  repo: string;        // "owner/repo"
  path: string;        // đường dẫn trong repo
  title: string;       // tên hiển thị
  content: string;     // nội dung markdown
  type: 'document' | 'folder';
  branch: string;      // branch mục tiêu
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** Subscribe to all docs, returns unsubscribe function */
export function subscribeDocs(
  callback: (docs: DocEntry[]) => void
): () => void {
  const q = query(collection(db, 'docs'), orderBy('path', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const docs: DocEntry[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<DocEntry, 'id'>),
    }));
    callback(docs);
  });
}

/** Fetch a single doc by id */
export async function fetchDoc(id: string): Promise<DocEntry | null> {
  const ref = doc(db, 'docs', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<DocEntry, 'id'>) };
}

/** Subscribe to sync meta */
export function subscribeSyncMeta(
  callback: (meta: SyncMeta) => void
): () => void {
  const ref = doc(db, 'syncMeta', 'status');
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as SyncMeta);
    } else {
      callback({ lastSyncAt: null, lastSyncStatus: 'idle' });
    }
  });
}

// ──────────────────────────────────────────────
//  DRAFT CRUD
// ──────────────────────────────────────────────

/** Lưu draft vào Firestore */
export async function saveDraft(draft: Omit<DraftEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  // Tạo id từ path (thay / bằng __)
  const id = draft.path.replace(/\//g, '__').replace(/\.md$/, '');
  const ref = doc(db, 'drafts', id);
  const existing = await getDoc(ref);
  await setDoc(ref, {
    ...draft,
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

/** Lấy 1 draft */
export async function getDraft(id: string): Promise<DraftEntry | null> {
  const ref = doc(db, 'drafts', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<DraftEntry, 'id'>) };
}

/** Subscribe to all drafts */
export function subscribeDrafts(
  callback: (drafts: DraftEntry[]) => void
): () => void {
  const q = query(collection(db, 'drafts'), orderBy('path', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const drafts: DraftEntry[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<DraftEntry, 'id'>),
    }));
    callback(drafts);
  });
}

/** Lấy tất cả drafts một lần */
export async function getAllDrafts(): Promise<DraftEntry[]> {
  const q = query(collection(db, 'drafts'), orderBy('path', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<DraftEntry, 'id'>),
  }));
}

/** Xóa 1 draft */
export async function deleteDraft(id: string): Promise<void> {
  await deleteDoc(doc(db, 'drafts', id));
}

/** Cập nhật nội dung draft */
export async function updateDraftContent(id: string, content: string): Promise<void> {
  const ref = doc(db, 'drafts', id);
  await setDoc(ref, { content, updatedAt: serverTimestamp() }, { merge: true });
}
