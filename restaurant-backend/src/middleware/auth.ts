import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/types/api';

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // More robust way to extract token
    let token: string | undefined;
    
    // Check Authorization header (case insensitive)
    const authHeader = req.get('Authorization') || req.headers['authorization'];
    if (authHeader && typeof authHeader === 'string') {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    // Also check for token in body or query (as fallback)
    if (!token && req.body) {
      token = req.body['token'];
    }
    
    if (!token && req.query) {
      token = req.query['token'] as string;
    }

    if (!token) {
      console.log('No token found in request');
      console.log('Headers:', req.headers);
      console.log('Body:', req.body);
      throw new AppError('Access denied. No token provided.', 401);
    }

    // Check if JWT_SECRET is properly configured
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured in environment variables');
      throw new AppError('Server configuration error.', 500);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        verified: true,
        phone: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid token.', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token.', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token expired.', 401));
    } else {
      next(error);
    }
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
    // More robust way to extract token
    let token: string | undefined;
    
    // Check Authorization header (case insensitive)
    const authHeader = req.get('Authorization') || req.headers['authorization'];
    if (authHeader && typeof authHeader === 'string') {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
      // Check if JWT_SECRET is properly configured
      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not configured in environment variables');
        throw new Error('Server configuration error.');
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};