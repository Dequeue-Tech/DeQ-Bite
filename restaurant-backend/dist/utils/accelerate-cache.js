"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accelerateCache = void 0;
const accelerateCache = (ttl, swr) => {
    if (!process.env.DATABASE_URL?.startsWith('prisma+')) {
        return {};
    }
    return swr ? { cacheStrategy: { ttl, swr } } : { cacheStrategy: { ttl } };
};
exports.accelerateCache = accelerateCache;
//# sourceMappingURL=accelerate-cache.js.map