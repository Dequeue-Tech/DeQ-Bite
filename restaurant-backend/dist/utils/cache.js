"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateCacheByPrefix = void 0;
const redis_1 = require("./redis");
const invalidateCacheByPrefix = async (prefix, restaurantId) => {
    const client = (0, redis_1.getRedisClient)();
    if (!client || client.status !== 'ready')
        return;
    const pattern = `cache:${prefix}:${restaurantId}:*`;
    let cursor = '0';
    do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        if (keys.length > 0) {
            await client.del(keys);
        }
        cursor = nextCursor;
    } while (cursor !== '0');
};
exports.invalidateCacheByPrefix = invalidateCacheByPrefix;
//# sourceMappingURL=cache.js.map