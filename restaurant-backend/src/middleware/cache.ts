import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '@/utils/redis';

const buildCacheKey = (prefix: string, req: Request) => {
  const restaurantId = (req as any).restaurant?.id || 'global';
  return `cache:${prefix}:${restaurantId}:${req.originalUrl}`;
};

export const cacheResponse = (
  ttlSeconds: number,
  prefix: string,
  options?: { skip?: (req: Request) => boolean }
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();
    if (options?.skip?.(req)) return next();

    const cacheControl = req.headers['cache-control'];
    if (typeof cacheControl === 'string' && cacheControl.includes('no-cache')) {
      return next();
    }

    const client = getRedisClient();
    if (!client || client.status !== 'ready') return next();

    const key = buildCacheKey(prefix, req);
    try {
      const cached = await client.get(key);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
    } catch {
      // ignore cache read errors
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          client.set(key, JSON.stringify(body), 'EX', ttlSeconds).catch(() => {});
        }
      } catch {
        // ignore cache write errors
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    }) as Response['json'];

    return next();
  };
};
