import Redis from 'ioredis';

/**
 * BullMQ requires ioredis with `maxRetriesPerRequest: null`.
 * Use a separate connection instance per Queue and per Worker.
 */
export const createBullmqConnection = (): Redis => {
  const url = process.env['REDIS_URL']?.trim();
  if (url) {
    return new Redis(url, { maxRetriesPerRequest: null });
  }

  const host = process.env['REDIS_HOST']?.trim() || '127.0.0.1';
  const port = parseInt(process.env['REDIS_PORT'] || '6379', 10);
  const password = process.env['REDIS_PASSWORD'];

  return new Redis({
    host,
    port,
    ...(password ? { password } : {}),
    maxRetriesPerRequest: null,
  });
};

/** True when explicit Redis settings exist (enables BullMQ instead of in-process fallback). */
export const isBullmqRedisConfigured = (): boolean =>
  Boolean(process.env['REDIS_URL']?.trim() || process.env['REDIS_HOST']?.trim());
