"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
console.log('Starting connection-test.ts');
require("../vercel-env");
console.log('Environment variables loaded');
const database_1 = require("../src/config/database");
console.log('Database module imported');
const serverless_http_1 = __importDefault(require("serverless-http"));
const express_1 = __importDefault(require("express"));
console.log('Creating express app for connection test');
const app = (0, express_1.default)();
app.get('/connection-test', async (_req, res) => {
    try {
        console.log('Starting connection test');
        const prisma = (0, database_1.getPrismaClient)();
        console.log('Prisma client acquired');
        console.log('Executing simple query');
        const result = await prisma.$queryRaw `SELECT 1 as test`;
        console.log('Query executed successfully:', result);
        res.status(200).json({
            success: true,
            message: 'Database connection test successful',
            result
        });
    }
    catch (error) {
        console.error('Connection test failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
console.log('Creating serverless function for connection test');
const handler = (0, serverless_http_1.default)(app);
console.log('Exporting connection test handler');
exports.default = handler;
exports.config = {
    maxDuration: 10,
    memory: 512,
};
//# sourceMappingURL=connection-test.js.map