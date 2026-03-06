import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

const createPrismaClient = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'production' 
      ? ['error', 'warn'] 
      : ['query', 'info', 'warn', 'error'],
  });

  // Check if using Prisma Accelerate (prisma+postgres:// or prisma+mysql://)
  const databaseUrl = process.env.DATABASE_URL || '';
  if (databaseUrl.startsWith('prisma+')) {
    try {
      // Load accelerate extension only when explicitly needed.
      // This prevents startup failure if the package isn't installed.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { withAccelerate } = require('@prisma/extension-accelerate');
      return client.$extends(withAccelerate());
    } catch (error) {
      logger.warn('Prisma Accelerate requested but @prisma/extension-accelerate is not installed. Falling back to regular Prisma client.');
      return client;
    }
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
