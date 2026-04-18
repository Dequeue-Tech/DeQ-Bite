"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyFirebaseIdToken = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const logger_1 = require("@/utils/logger");
let firebaseApp = null;
const extractProjectIdFromClientEmail = (clientEmail) => {
    if (!clientEmail)
        return null;
    const match = clientEmail.match(/@([^.]+)\.iam\.gserviceaccount\.com$/);
    return match?.[1] || null;
};
const getFirebaseCredential = () => {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectIdFromClientEmail = extractProjectIdFromClientEmail(clientEmail);
    const projectId = process.env.FIREBASE_PROJECT_ID || projectIdFromClientEmail;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
    }
    if (process.env.FIREBASE_PROJECT_ID && projectIdFromClientEmail && process.env.FIREBASE_PROJECT_ID !== projectIdFromClientEmail) {
        logger_1.logger.warn(`Firebase project mismatch detected: FIREBASE_PROJECT_ID=${process.env.FIREBASE_PROJECT_ID}, service-account-project=${projectIdFromClientEmail}.`);
    }
    return {
        projectId,
        clientEmail,
        privateKey,
    };
};
const getFirebaseApp = () => {
    if (firebaseApp) {
        return firebaseApp;
    }
    if (firebase_admin_1.default.apps.length > 0) {
        firebaseApp = firebase_admin_1.default.apps[0];
        return firebaseApp;
    }
    firebaseApp = firebase_admin_1.default.initializeApp({
        credential: firebase_admin_1.default.credential.cert(getFirebaseCredential()),
    });
    return firebaseApp;
};
const verifyFirebaseIdToken = async (token) => {
    const app = getFirebaseApp();
    return app.auth().verifyIdToken(token);
};
exports.verifyFirebaseIdToken = verifyFirebaseIdToken;
//# sourceMappingURL=firebase-admin.js.map