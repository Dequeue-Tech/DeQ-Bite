import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPrismaClient } from '../config/database'; // Use lazy initialization
import { AppError } from './errorHandler';
import { AuthenticatedRequest } from '../types/api';

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new AppError('Access denied. No token provided.', 401);
    }

    // Verify token first before database query to reduce unnecessary DB calls
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    const prisma = getPrismaClient(); // Lazy initialization
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
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      // Verify token first before database query to reduce unnecessary DB calls
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        const prisma = getPrismaClient(); // Lazy initialization
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
      } catch (error) {
        // Invalid token, continue without authentication
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};