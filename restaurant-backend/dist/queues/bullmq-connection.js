"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBullmqRedisConfigured = exports.createBullmqConnection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const createBullmqConnection = () => {
    const url = process.env['REDIS_URL']?.trim();
    if (url) {
        return new ioredis_1.default(url, { maxRetriesPerRequest: null });
    }
    const host = process.env['REDIS_HOST']?.trim() || '127.0.0.1';
    const port = parseInt(process.env['REDIS_PORT'] || '6379', 10);
    const password = process.env['REDIS_PASSWORD'];
    return new ioredis_1.default({
        host,
        port,
        ...(password ? { password } : {}),
        maxRetriesPerRequest: null,
    });
};
exports.createBullmqConnection = createBullmqConnection;
const isBullmqRedisConfigured = () => Boolean(process.env['REDIS_URL']?.trim() || process.env['REDIS_HOST']?.trim());
exports.isBullmqRedisConfigured = isBullmqRedisConfigured;
//# sourceMappingURL=bullmq-connection.js.map