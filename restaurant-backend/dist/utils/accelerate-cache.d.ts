export declare const accelerateCache: (ttl: number, swr?: number) => {
    cacheStrategy?: never;
} | {
    cacheStrategy: {
        ttl: number;
        swr: number;
    };
} | {
    cacheStrategy: {
        ttl: number;
        swr?: never;
    };
};
//# sourceMappingURL=accelerate-cache.d.ts.map