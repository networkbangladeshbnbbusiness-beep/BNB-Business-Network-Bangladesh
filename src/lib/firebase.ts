import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const TARGET_DATABASE_ID = "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959";

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalAutoDetectLongPolling: true
}, TARGET_DATABASE_ID); /* CRITICAL: The app will break without this line */

export const auth = getAuth(app);
export const messaging = getMessaging(app);

// Sign in anonymously to bootstrap Auth UID so security rules resolve correctly
let fallbackUid: string | null = null;
function getOrCreateFallbackUid() {
  if (!fallbackUid) {
    fallbackUid = localStorage.getItem('bnb_fallback_uid');
    if (!fallbackUid) {
      fallbackUid = 'anon_user_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('bnb_fallback_uid', fallbackUid);
    }
  }
  return fallbackUid;
}

export async function ensureAuth() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.warn("Auth initialization failed (using fallback local UID):", e);
    }
  }
  if (auth.currentUser) {
    return { uid: auth.currentUser.uid, email: auth.currentUser.email };
  } else {
    return { uid: getOrCreateFallbackUid(), email: null };
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
