"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const errorHandler_1 = require("./errorHandler");
const authenticate = async (req, _res, next) => {
    try {
        let token;
        const authHeader = req.get('Authorization') || req.headers['authorization'];
        if (authHeader && typeof authHeader === 'string') {
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        if (!token && req.body) {
            token = req.body['token'];
        }
        if (!token && req.query) {
            token = req.query['token'];
        }
        if (!token) {
            console.log('No token found in request');
            console.log('Headers:', req.headers);
            console.log('Body:', req.body);
            throw new errorHandler_1.AppError('Access denied. No token provided.', 401);
        }
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not configured in environment variables');
            throw new errorHandler_1.AppError('Server configuration error.', 500);
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await database_1.prisma.user.findUnique({
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
            throw new errorHandler_1.AppError('Invalid token.', 401);
        }
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            next(new errorHandler_1.AppError('Invalid token.', 401));
        }
        else if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            next(new errorHandler_1.AppError('Token expired.', 401));
        }
        else {
            next(error);
        }
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
        let token;
        const authHeader = req.get('Authorization') || req.headers['authorization'];
        if (authHeader && typeof authHeader === 'string') {
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        if (token) {
            if (!process.env.JWT_SECRET) {
                console.error('JWT_SECRET is not configured in environment variables');
                throw new Error('Server configuration error.');
            }
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            const user = await database_1.prisma.user.findUnique({
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
    }
    catch (error) {
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map