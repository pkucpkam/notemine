import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth, githubProvider } from './firebase';
import { ALLOWED_UID } from './config';

export async function signInWithGitHub(): Promise<User> {
  const result = await signInWithPopup(auth, githubProvider);
  if (ALLOWED_UID && result.user.uid !== ALLOWED_UID) {
    await signOut(auth);
    throw new Error('ACCESS_DENIED');
  }
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (user && ALLOWED_UID && user.uid !== ALLOWED_UID) {
      signOut(auth);
      callback(null);
    } else {
      callback(user);
    }
  });
}
