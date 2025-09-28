"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
console.log('test-simple.ts: Starting at:', new Date().toISOString());
const serverless_http_1 = __importDefault(require("serverless-http"));
console.log('test-simple.ts: serverless-http imported at:', new Date().toISOString());
const express_1 = __importDefault(require("express"));
console.log('test-simple.ts: express imported at:', new Date().toISOString());
const app = (0, express_1.default)();
console.log('test-simple.ts: Express app created at:', new Date().toISOString());
app.get('/test-simple', (_req, res) => {
    console.log('test-simple.ts: /test-simple endpoint hit at:', new Date().toISOString());
    res.status(200).json({
        message: 'Simple test working!',
        timestamp: new Date().toISOString()
    });
});
app.get('/test-debug', (_req, res) => {
    console.log('test-simple.ts: /test-debug endpoint hit at:', new Date().toISOString());
    try {
        if (process._getActiveHandles) {
            const handles = process._getActiveHandles();
            console.log('test-simple debug: Active handles count:', handles.length);
        }
        if (process._getActiveRequests) {
            const requests = process._getActiveRequests();
            console.log('test-simple debug: Active requests count:', requests.length);
        }
    }
    catch (error) {
        console.log('test-simple debug: Error checking handles:', error);
    }
    res.status(200).json({
        message: 'Simple debug test working!',
        timestamp: new Date().toISOString()
    });
});
console.log('test-simple.ts: Routes configured at:', new Date().toISOString());
const handler = (0, serverless_http_1.default)(app);
console.log('test-simple.ts: Serverless function created at:', new Date().toISOString());
exports.default = handler;
exports.config = {
    maxDuration: 5,
    memory: 512,
};
console.log('test-simple.ts: Initialization complete at:', new Date().toISOString());
//# sourceMappingURL=test-simple.js.map