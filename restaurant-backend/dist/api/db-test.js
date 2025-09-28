"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const serverless_http_1 = __importDefault(require("serverless-http"));
const express_1 = __importDefault(require("express"));
const database_1 = require("../src/config/database");
const app = (0, express_1.default)();
app.get('/db-test', async (_req, res) => {
    try {
        console.log('Getting Prisma client in test');
        const prisma = (0, database_1.getPrismaClient)();
        console.log('Prisma client acquired');
        const count = await prisma.user.count();
        console.log('Database query completed');
        res.status(200).json({
            message: 'Database test working!',
            userCount: count,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Database test failed:', error);
        res.status(500).json({
            error: 'Database test failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = (0, serverless_http_1.default)(app);
exports.config = {
    maxDuration: 10,
    memory: 512,
};
//# sourceMappingURL=db-test.js.map