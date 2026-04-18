"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
let redisClient = null;
const getRedisClient = () => {
    const url = process.env.REDIS_URL;
    if (!url)
        return null;
    if (!redisClient) {
        redisClient = new ioredis_1.default(url, {
            maxRetriesPerRequest: 2,
            enableReadyCheck: true,
        });
        redisClient.on('error', (error) => {
            logger_1.logger.warn('Redis error', { message: error?.message || String(error) });
        });
        redisClient.on('ready', () => {
            logger_1.logger.info('Redis connection ready');
        });
    }
    if (redisClient.status === 'wait') {
        redisClient.connect().catch(() => {
        });
    }
    return redisClient;
};
exports.getRedisClient = getRedisClient;
//# sourceMappingURL=redis.js.map