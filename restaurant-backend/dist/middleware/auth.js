"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authorize = exports.authenticate = void 0;
const client_1 = require("@prisma/client");
const firebase_user_1 = require("../lib/firebase-user");
const errorHandler_1 = require("./errorHandler");
const decodeJwtPayload = (token) => {
    const parts = token.split('.');
    if (parts.length !== 3)
        return null;
    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        return payload;
    }
    catch {
        return null;
    }
};
const getFirebaseAuthErrorMessage = (error, token) => {
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
        return 'Database schema is out of date for Firebase auth. Run Prisma migration to add required columns.';
    }
    const firebaseCode = error?.code;
    if (firebaseCode === 'auth/id-token-expired') {
        return 'Firebase token expired. Please sign in again.';
    }
    if (firebaseCode === 'auth/argument-error') {
        return 'Invalid Firebase token format. Please sign in again.';
    }
    const payload = decodeJwtPayload(token);
    const expectedProjectId = process.env.FIREBASE_PROJECT_ID;
    if (payload?.aud && expectedProjectId && payload.aud !== expectedProjectId) {
        return `Firebase token project mismatch. Token audience "${payload.aud}" does not match FIREBASE_PROJECT_ID "${expectedProjectId}".`;
    }
    if (payload?.exp && payload.exp * 1000 < Date.now()) {
        return 'Firebase token expired. Please sign in again.';
    }
    return 'Invalid or expired Firebase token.';
};
const extractToken = (req) => {
    const authHeader = req.get('Authorization') || req.headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    if (req.body && typeof req.body.token === 'string') {
        return req.body.token;
    }
    if (req.query && typeof req.query['token'] === 'string') {
        return req.query['token'];
    }
    return undefined;
};
const authenticate = async (req, _res, next) => {
    try {
        const token = extractToken(req);
        if (!token) {
            throw new errorHandler_1.AppError('Access denied. No token provided.', 401);
        }
        const user = await (0, firebase_user_1.ensureAuthenticatedUserFromToken)(token);
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            return next(error);
        }
        const token = extractToken(req) || '';
        next(new errorHandler_1.AppError(getFirebaseAuthErrorMessage(error, token), 401));
    }
};
exports.authenticate = authenticate;
const authorize = (...roles) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new errorHandler_1.AppError('Access denied. Authentication required.', 401));
        }
        if (!roles.includes(req.user.role)) {
            return next(new errorHandler_1.AppError('Access denied. Insufficient permissions.', 403));
        }
        next();
    };
};
exports.authorize = authorize;
const optionalAuth = async (req, _res, next) => {
    try {
        const token = extractToken(req);
        if (token) {
            req.user = await (0, firebase_user_1.ensureAuthenticatedUserFromToken)(token);
        }
        next();
    }
    catch (_error) {
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map