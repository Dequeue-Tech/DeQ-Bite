"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
console.log('test-minimal-app.ts: Starting at:', new Date().toISOString());
const serverless_http_1 = __importDefault(require("serverless-http"));
console.log('test-minimal-app.ts: serverless-http imported at:', new Date().toISOString());
const server_1 = __importDefault(require("../src/server"));
console.log('test-minimal-app.ts: App imported at:', new Date().toISOString());
const handler = (0, serverless_http_1.default)(server_1.default, {
    binary: ['*/*'],
});
console.log('test-minimal-app.ts: Serverless function created at:', new Date().toISOString());
const debugHandler = async (event, context) => {
    console.log('test-minimal-app.ts: Handler called at:', new Date().toISOString());
    console.log('test-minimal-app.ts: Event type:', typeof event);
    console.log('test-minimal-app.ts: Event keys:', Object.keys(event || {}).slice(0, 10));
    console.log('test-minimal-app.ts: Context:', {
        awsRequestId: context.awsRequestId,
        functionName: context.functionName,
        functionVersion: context.functionVersion,
        memoryLimitInMB: context.memoryLimitInMB,
        timeout: context.getRemainingTimeInMillis ? context.getRemainingTimeInMillis() : 'unknown'
    });
    try {
        const result = await handler(event, context);
        console.log('test-minimal-app.ts: Handler completed successfully at:', new Date().toISOString());
        return result;
    }
    catch (error) {
        console.error('test-minimal-app.ts: Handler error at:', new Date().toISOString(), error);
        throw error;
    }
};
exports.default = debugHandler;
exports.config = {
    maxDuration: 5,
    memory: 512,
};
console.log('test-minimal-app.ts: Initialization complete at:', new Date().toISOString());
//# sourceMappingURL=test-minimal-app.js.map