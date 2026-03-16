import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { logger } from '@/utils/logger';

const createPrismaClient = () => {
  const shouldLogQueries = process.env.LOG_SLOW_QUERIES !== 'false';
  const slowQueryMs = Number(process.env.SLOW_QUERY_MS || 200);
  const log: any[] = process.env.NODE_ENV === 'production'
    ? ['error', 'warn']
    : ['query', 'info', 'warn', 'error'];

  if (shouldLogQueries) {
    log.push({ emit: 'event', level: 'query' });
  }

  let client: any = new PrismaClient({ log });

  if (shouldLogQueries && typeof client.$on === 'function') {
    client.$on('query', (e: any) => {
      if (e.duration >= slowQueryMs) {
        const includeParams = process.env.LOG_SLOW_QUERY_PARAMS === 'true';
        logger.warn('Slow query detected', {
          durationMs: e.duration,
          query: e.query,
          ...(includeParams ? { params: e.params } : {}),
          target: e.target,
        });
      }
    });
  }

  // Check if using Prisma Accelerate (prisma+postgres:// or prisma+mysql://)
  const databaseUrl = process.env.DATABASE_URL || '';
  if (databaseUrl.startsWith('prisma+')) {
    client = client.$extends(withAccelerate());
  }

  return client;
};

let prisma: ReturnType<typeof createPrismaClient>;

declare global {
  var __prisma: ReturnType<typeof createPrismaClient> | undefined;
}

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }
  prisma = global.__prisma;
}

export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    logger.info('✅ Database disconnected successfully');
  } catch (error) {
    logger.error('❌ Database disconnection failed:', error);
    throw error;
  }
};

export { prisma };

