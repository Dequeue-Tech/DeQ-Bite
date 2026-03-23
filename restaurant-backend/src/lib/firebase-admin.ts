import admin from 'firebase-admin';
import { logger } from '@/utils/logger';

let firebaseApp: admin.app.App | null = null;

const extractProjectIdFromClientEmail = (clientEmail?: string) => {
  if (!clientEmail) return null;
  const match = clientEmail.match(/@([^.]+)\.iam\.gserviceaccount\.com$/);
  return match?.[1] || null;
};

const getFirebaseCredential = (): admin.ServiceAccount => {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectIdFromClientEmail = extractProjectIdFromClientEmail(clientEmail);
  const projectId = process.env.FIREBASE_PROJECT_ID || projectIdFromClientEmail;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
  }

  if (process.env.FIREBASE_PROJECT_ID && projectIdFromClientEmail && process.env.FIREBASE_PROJECT_ID !== projectIdFromClientEmail) {
    logger.warn(
      `Firebase project mismatch detected: FIREBASE_PROJECT_ID=${process.env.FIREBASE_PROJECT_ID}, service-account-project=${projectIdFromClientEmail}.`
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
};

const getFirebaseApp = (): admin.app.App => {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (admin.apps.length > 0) {
    firebaseApp = admin.apps[0]!;
    return firebaseApp;
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(getFirebaseCredential()),
  });

  return firebaseApp;
};

export const verifyFirebaseIdToken = async (token: string) => {
  const app = getFirebaseApp();
  return app.auth().verifyIdToken(token);
};
