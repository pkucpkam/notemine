import * as admin from 'firebase-admin';
import { syncRepo } from './syncRepo';
import { commitFile } from './commitFile';

admin.initializeApp();

export { syncRepo, commitFile };
