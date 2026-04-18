"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheResponse = void 0;
const redis_1 = require("../utils/redis");
const buildCacheKey = (prefix, req) => {
    const restaurantId = req.restaurant?.id || 'global';
    return `cache:${prefix}:${restaurantId}:${req.originalUrl}`;
};
const cacheResponse = (ttlSeconds, prefix, options) => {
    return async (req, res, next) => {
        if (req.method !== 'GET')
            return next();
        if (options?.skip?.(req))
            return next();
        const cacheControl = req.headers['cache-control'];
        if (typeof cacheControl === 'string' && cacheControl.includes('no-cache')) {
            return next();
        }
        const client = (0, redis_1.getRedisClient)();
        if (!client || client.status !== 'ready')
            return next();
        const key = buildCacheKey(prefix, req);
        try {
            const cached = await client.get(key);
            if (cached) {
                res.setHeader('X-Cache', 'HIT');
                return res.json(JSON.parse(cached));
            }
        }
        catch {
        }
        const originalJson = res.json.bind(res);
        res.json = ((body) => {
            try {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    client.set(key, JSON.stringify(body), 'EX', ttlSeconds).catch(() => { });
                }
            }
            catch {
            }
            res.setHeader('X-Cache', 'MISS');
            return originalJson(body);
        });
        return next();
    };
};
exports.cacheResponse = cacheResponse;
//# sourceMappingURL=cache.js.map