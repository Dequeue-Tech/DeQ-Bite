import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let { statusCode = 500, message } = err;

  // Log error details
  if (process.env.NODE_ENV === 'development') {
    logger.error('Error details:', {
      message: err.message,
      stack: err.stack,
      url: _req.originalUrl,
      method: _req.method,
      ip: _req.ip,
      userAgent: _req.get('User-Agent'),
    });
  } else {
    logger.error('Error occurred:', {
      message: err.message,
      url: _req.originalUrl,
      method: _req.method,
      ip: _req.ip,
    });
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database operation failed';
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    message = 'Something went wrong';
  }

  // Ensure we haven't already sent a response
  if (res.headersSent) {
    return _next(err);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  // Using Promise.resolve to handle both sync and async functions
  // Ensuring we pass all three parameters to the wrapped function
  Promise.resolve(fn(req, res, next)).catch(next);
};