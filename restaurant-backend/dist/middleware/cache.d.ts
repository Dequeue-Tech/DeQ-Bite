import { Request, Response, NextFunction } from 'express';
export declare const cacheResponse: (ttlSeconds: number, prefix: string, options?: {
    skip?: (req: Request) => boolean;
}) => (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=cache.d.ts.map