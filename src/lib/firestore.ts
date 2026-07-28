import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  Timestamp,
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
