import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ensureAuthenticatedUserFromToken } from '@/lib/firebase-user';
import { AppError } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/types/api';

type DecodedJwtPayload = {
  aud?: string;
  exp?: number;
  iss?: string;
};

const decodeJwtPayload = (token: string): DecodedJwtPayload | null => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as DecodedJwtPayload;
    return payload;
  } catch {
    return null;
  }
};

const getFirebaseAuthErrorMessage = (error: unknown, token: string): string => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
    return 'Database schema is out of date for Firebase auth. Run Prisma migration to add required columns.';
  }

  const firebaseCode = (error as { code?: string } | undefined)?.code;
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

const extractToken = (req: AuthenticatedRequest): string | undefined => {
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

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new AppError('Access denied. No token provided.', 401);
    }

    const user = await ensureAuthenticatedUserFromToken(token);
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    const token = extractToken(req) || '';
    next(new AppError(getFirebaseAuthErrorMessage(error, token), 401));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Access denied. Authentication required.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Access denied. Insufficient permissions.', 403));
    }

    next();
  };
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (token) {
      req.user = await ensureAuthenticatedUserFromToken(token);
    }

    next();
  } catch (_error) {
    // Continue without authentication for optional auth
    next();
  }
};
