"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimIdempotencyKey = exports.extractIdempotencyKey = void 0;
const redis_1 = require("./redis");
const FALLBACK_IDEMPOTENCY_KEYS = new Map();
const DEFAULT_TTL_SECONDS = 5 * 60;
const cleanupFallbackMap = () => {
    const now = Date.now();
    FALLBACK_IDEMPOTENCY_KEYS.forEach((expiresAt, key) => {
        if (expiresAt <= now) {
            FALLBACK_IDEMPOTENCY_KEYS.delete(key);
        }
    });
};
const extractIdempotencyKey = (req) => {
    const headerKey = req.get('Idempotency-Key') || req.get('idempotency-key');
    if (typeof headerKey === 'string' && headerKey.trim()) {
        return headerKey.trim();
    }
    const bodyKey = req.body && typeof req.body['idempotencyKey'] === 'string'
        ? req.body['idempotencyKey']
        : '';
    if (bodyKey.trim()) {
        return bodyKey.trim();
    }
    return null;
};
exports.extractIdempotencyKey = extractIdempotencyKey;
const claimIdempotencyKey = async (input) => {
    const ttlSeconds = Math.max(10, input.ttlSeconds ?? DEFAULT_TTL_SECONDS);
    const scopedKey = `idempotency:${input.scope}:${input.key}`;
    const redis = (0, redis_1.getRedisClient)();
    if (redis) {
        const result = await redis.set(scopedKey, String(Date.now()), 'EX', ttlSeconds, 'NX');
        return result === 'OK';
    }
    cleanupFallbackMap();
    if (FALLBACK_IDEMPOTENCY_KEYS.has(scopedKey)) {
        return false;
    }
    FALLBACK_IDEMPOTENCY_KEYS.set(scopedKey, Date.now() + ttlSeconds * 1000);
    return true;
};
exports.claimIdempotencyKey = claimIdempotencyKey;
//# sourceMappingURL=idempotency.js.map