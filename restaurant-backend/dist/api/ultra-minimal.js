"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
console.log('Ultra minimal test starting at:', new Date().toISOString());
const serverless_http_1 = __importDefault(require("serverless-http"));
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
app.get('/ultra-minimal', (_req, res) => {
    console.log('Ultra minimal endpoint hit at:', new Date().toISOString());
    res.status(200).json({
        message: 'Ultra minimal test working!',
        timestamp: new Date().toISOString()
    });
});
app.get('/ultra-debug', (_req, res) => {
    console.log('Ultra debug endpoint hit at:', new Date().toISOString());
    try {
        if (process._getActiveHandles) {
            const handles = process._getActiveHandles();
            console.log('Ultra debug: Active handles count:', handles.length);
            handles.slice(0, 10).forEach((handle, index) => {
                console.log(`Ultra debug: Handle ${index}:`, handle.constructor?.name || typeof handle);
                if (handle.constructor?.name === 'Socket') {
                    console.log(`Ultra debug: Socket handle ${index} info:`, {
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
            console.log('Ultra debug: Active requests count:', requests.length);
        }
    }
    catch (error) {
        console.log('Ultra debug: Error checking handles:', error);
    }
    res.status(200).json({
        message: 'Ultra debug test working!',
        timestamp: new Date().toISOString()
    });
});
const handler = (0, serverless_http_1.default)(app, {
    request: (request) => {
        console.log('Ultra minimal: Processing request at:', new Date().toISOString());
        return request;
    },
    response: (response) => {
        console.log('Ultra minimal: Processing response at:', new Date().toISOString());
        return response;
    }
});
exports.default = handler;
exports.config = {
    maxDuration: 5,
    memory: 512,
};
console.log('Ultra minimal test initialization complete at:', new Date().toISOString());
//# sourceMappingURL=ultra-minimal.js.map