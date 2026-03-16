import { getRedisClient } from '@/utils/redis';

export const invalidateCacheByPrefix = async (prefix: string, restaurantId: string) => {
  const client = getRedisClient();
  if (!client || client.status !== 'ready') return;

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
