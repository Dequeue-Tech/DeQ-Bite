"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.errorHandler = exports.AppError = void 0;
const logger_1 = require("../utils/logger");
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const errorHandler = (err, _req, res, _next) => {
    let { statusCode = 500, message } = err;
    if (process.env.NODE_ENV === 'development') {
        logger_1.logger.error('Error details:', {
            message: err.message,
            stack: err.stack,
            url: _req.originalUrl,
            method: _req.method,
            ip: _req.ip,
            userAgent: _req.get('User-Agent'),
        });
    }
    else {
        logger_1.logger.error('Error occurred:', {
            message: err.message,
            url: _req.originalUrl,
            method: _req.method,
            ip: _req.ip,
        });
    }
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
    }
    else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
    }
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }
    else if (err.name === 'PrismaClientKnownRequestError') {
        statusCode = 400;
        message = 'Database operation failed';
    }
    if (process.env.NODE_ENV === 'production' && !err.isOperational) {
        message = 'Something went wrong';
    }
    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};
exports.errorHandler = errorHandler;
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errorHandler.js.map