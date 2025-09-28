"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
console.log('api/index.ts: Starting at:', new Date().toISOString());
require("../vercel-env");
console.log('api/index.ts: Environment loaded at:', new Date().toISOString());
const serverless_http_1 = __importDefault(require("serverless-http"));
console.log('api/index.ts: serverless-http imported at:', new Date().toISOString());
const server_1 = __importDefault(require("../src/server"));
console.log('api/index.ts: App imported at:', new Date().toISOString());
console.log('api/index.ts: Creating serverless function at:', new Date().toISOString());
const handler = (0, serverless_http_1.default)(server_1.default, {
    binary: ['*/*'],
    request: (request) => {
        console.log('api/index.ts: Processing request at:', new Date().toISOString());
        console.log('api/index.ts: Request method:', request.method);
        console.log('api/index.ts: Request url:', request.url);
        console.log('api/index.ts: Request headers keys:', Object.keys(request.headers || {}));
        return request;
    },
    response: (response) => {
        console.log('api/index.ts: Processing response at:', new Date().toISOString());
        console.log('api/index.ts: Response status code:', response.statusCode);
        return response;
    }
});
console.log('api/index.ts: Serverless function created at:', new Date().toISOString());
const debugHandler = async (event, context) => {
    console.log('api/index.ts: Handler called at:', new Date().toISOString());
    console.log('api/index.ts: Event type:', typeof event);
    console.log('api/index.ts: Event keys:', Object.keys(event || {}).slice(0, 10));
    console.log('api/index.ts: Context:', {
        awsRequestId: context.awsRequestId,
        functionName: context.functionName,
        functionVersion: context.functionVersion,
        memoryLimitInMB: context.memoryLimitInMB,
        timeout: context.getRemainingTimeInMillis ? context.getRemainingTimeInMillis() : 'unknown'
    });
    try {
        const result = await handler(event, context);
        console.log('api/index.ts: Handler completed successfully at:', new Date().toISOString());
        return result;
    }
    catch (error) {
        console.error('api/index.ts: Handler error at:', new Date().toISOString(), error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error: 'Internal Server Error',
                message: 'An error occurred while processing the request'
            })
        };
    }
    finally {
        console.log('api/index.ts: Handler finally block at:', new Date().toISOString());
    }
};
console.log('api/index.ts: Exporting handler at:', new Date().toISOString());
exports.default = debugHandler;
exports.config = {
    maxDuration: 10,
    memory: 512,
};
console.log('api/index.ts: Initialization complete at:', new Date().toISOString());
//# sourceMappingURL=index.js.map