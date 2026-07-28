import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// Store GitHub PAT in Firestore (only you can read it, locked by security rules)
export async function saveGitHubToken(token: string): Promise<void> {
  await setDoc(doc(db, 'settings', 'github'), { token });
}

export async function getGitHubToken(): Promise<string | null> {
  const snap = await getDoc(doc(db, 'settings', 'github'));
  if (!snap.exists()) return null;
  return (snap.data() as { token: string }).token || null;
}
