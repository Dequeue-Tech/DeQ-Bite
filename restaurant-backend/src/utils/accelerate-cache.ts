export const accelerateCache = (ttl: number, swr?: number) => {
  if (!process.env.DATABASE_URL?.startsWith('prisma+')) {
    return {};
  }
  return swr ? { cacheStrategy: { ttl, swr } } : { cacheStrategy: { ttl } };
};
