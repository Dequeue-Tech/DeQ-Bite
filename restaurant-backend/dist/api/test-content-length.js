"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
console.log('Content-length test starting at:', new Date().toISOString());
const serverless_http_1 = __importDefault(require("serverless-http"));
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
app.use((req, _res, next) => {
    console.log('Content-length test: Request middleware hit at:', new Date().toISOString());
    console.log('Content-length test: Request method:', req.method);
    console.log('Content-length test: Request headers:', req.headers);
    if (req.method === 'GET') {
        req.body = {};
    }
    next();
});
app.get('/test-content-length', (req, res) => {
    console.log('Content-length test endpoint hit at:', new Date().toISOString());
    const contentLength = req.headers['content-length'];
    console.log('Content-length test: Content-Length header:', contentLength);
    res.status(200).json({
        message: 'Content-length test working!',
        contentLength: contentLength || 'none',
        method: req.method,
        timestamp: new Date().toISOString()
    });
});
app.use((err, req, _res, next) => {
    console.log('Content-length test: Error middleware hit at:', new Date().toISOString());
    console.log('Content-length test: Error:', err.message);
    if (err.message?.includes('request size did not match content length')) {
        console.log('Content-length test: Handling BadRequestError');
        req.body = {};
        return next();
    }
    next(err);
});
const handler = (0, serverless_http_1.default)(app, {
    request: (request) => {
        console.log('Content-length test: Processing request at:', new Date().toISOString());
        return request;
    },
    response: (response) => {
        console.log('Content-length test: Processing response at:', new Date().toISOString());
        return response;
    }
});
exports.default = handler;
exports.config = {
    maxDuration: 5,
    memory: 512,
};
console.log('Content-length test initialization complete at:', new Date().toISOString());
//# sourceMappingURL=test-content-length.js.map