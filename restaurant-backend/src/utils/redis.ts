import Redis from 'ioredis';
import { logger } from '@/utils/logger';

let redisClient: Redis | null = null;

export const getRedisClient = () => {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (!redisClient) {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    redisClient.on('error', (error) => {
      logger.warn('Redis error', { message: error?.message || String(error) });
    });

    redisClient.on('ready', () => {
      logger.info('Redis connection ready');
    });
  }

  if (redisClient.status === 'wait') {
    redisClient.connect().catch(() => {
      // ignore initial connection failures
    });
  }

  return redisClient;
};
