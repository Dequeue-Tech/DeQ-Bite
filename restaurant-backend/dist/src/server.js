"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
console.log('server.ts: Starting module load at:', new Date().toISOString());
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const errorHandler_1 = require("./middleware/errorHandler");
console.log('server.ts: Core modules imported at:', new Date().toISOString());
dotenv_1.default.config();
console.log('server.ts: Environment variables loaded at:', new Date().toISOString());
const app = (0, express_1.default)();
console.log('server.ts: Express app created at:', new Date().toISOString());
app.use((req, _res, next) => {
    console.log('server.ts: Request middleware hit at:', new Date().toISOString());
    console.log('server.ts: Request method:', req.method);
    console.log('server.ts: Request headers:', req.headers);
    const contentLength = req.headers['content-length'];
    if (contentLength) {
        console.log('server.ts: Content-Length header:', contentLength);
    }
    req.on('error', (err) => {
        console.log('server.ts: Request error:', err);
    });
    next();
});
app.use((req, res, next) => {
    console.log('server.ts: Body parsing middleware hit at:', new Date().toISOString());
    console.log('server.ts: Request method:', req.method);
    if (['GET', 'HEAD', 'DELETE'].includes(req.method)) {
        console.log('server.ts: Skipping body parsing for', req.method, 'request');
        req.body = {};
        return next();
    }
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        console.log('server.ts: Parsing body for', req.method);
        express_1.default.json({
            limit: '10mb',
            verify: (_req, _res, buf, encoding) => {
                console.log('server.ts: JSON body verification - length:', buf.length, 'encoding:', encoding);
            }
        })(req, res, (err) => {
            if (err) {
                console.log('server.ts: JSON parsing error:', err);
                req.body = {};
                return next();
            }
            next();
        });
    }
    else {
        console.log('server.ts: Skipping body parsing for', req.method);
        req.body = {};
        next();
    }
});
app.use((req, res, next) => {
    console.log('server.ts: URL encoding middleware hit at:', new Date().toISOString());
    console.log('server.ts: Request method:', req.method);
    if (['GET', 'HEAD', 'DELETE'].includes(req.method)) {
        console.log('server.ts: Skipping URL encoding parsing for', req.method, 'request');
        return next();
    }
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        console.log('server.ts: Parsing URL encoded body for', req.method);
        express_1.default.urlencoded({
            extended: true,
            limit: '10mb',
            verify: (_req, _res, buf, encoding) => {
                console.log('server.ts: URL encoded body verification - length:', buf.length, 'encoding:', encoding);
            }
        })(req, res, (err) => {
            if (err) {
                console.log('server.ts: URL encoding parsing error:', err);
                return next();
            }
            next();
        });
    }
    else {
        console.log('server.ts: Skipping URL encoding parsing for', req.method);
        next();
    }
});
console.log('server.ts: Middleware configured at:', new Date().toISOString());
app.get('/health', (_req, res) => {
    console.log('server.ts: /health endpoint hit at:', new Date().toISOString());
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});
app.get('/test', (_req, res) => {
    console.log('server.ts: /test endpoint hit at:', new Date().toISOString());
    res.status(200).json({ message: '✅ Test route working!' });
});
app.get('/', (_req, res) => {
    console.log('server.ts: / endpoint hit at:', new Date().toISOString());
    res.status(200).json({ message: 'Welcome to the API' });
});
app.get('/test-content-length', (req, res) => {
    console.log('server.ts: /test-content-length endpoint hit at:', new Date().toISOString());
    console.log('server.ts: Request headers:', req.headers);
    const contentLength = req.headers['content-length'];
    if (contentLength) {
        console.log('server.ts: Content-Length header present:', contentLength);
    }
    res.status(200).json({
        message: 'Content-length test endpoint working!',
        contentLength: contentLength || 'none',
        method: req.method,
        timestamp: new Date().toISOString()
    });
});
app.get('/debug-timeout', (_req, res) => {
    console.log('server.ts: /debug-timeout endpoint hit at:', new Date().toISOString());
    try {
        if (process._getActiveHandles) {
            const handles = process._getActiveHandles();
            console.log('server.ts: Active handles count:', handles.length);
            handles.slice(0, 10).forEach((handle, index) => {
                console.log(`server.ts: Handle ${index}:`, handle.constructor?.name || typeof handle);
                if (handle.constructor?.name === 'Socket') {
                    console.log(`server.ts: Socket handle ${index} info:`, {
                        destroyed: handle.destroyed,
                        readyState: handle.readyState,
                        timeout: handle.timeout,
                        allowHalfOpen: handle.allowHalfOpen,
                    });
                }
            });
        }
        if (process._getActiveRequests) {
            const requests = process._getActiveRequests();
            console.log('server.ts: Active requests count:', requests.length);
        }
    }
    catch (error) {
        console.log('server.ts: Error checking handles:', error);
    }
    res.status(200).json({
        message: 'Debug timeout endpoint working!',
        timestamp: new Date().toISOString()
    });
});
app.use((err, req, _res, next) => {
    console.log('server.ts: Error handling middleware hit at:', new Date().toISOString());
    console.log('server.ts: Error type:', err.constructor?.name || typeof err);
    console.log('server.ts: Error message:', err.message);
    if (err.type === 'entity.parse.failed' || err.message?.includes('request size did not match content length')) {
        console.log('server.ts: Handling BadRequestError specifically');
        req.body = req.body || {};
        return next();
    }
    next(err);
});
app.use(errorHandler_1.errorHandler);
console.log('server.ts: Server setup complete at:', new Date().toISOString());
exports.default = app;
console.log('server.ts: Module export complete at:', new Date().toISOString());
//# sourceMappingURL=server.js.map