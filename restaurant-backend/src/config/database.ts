import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

const createPrismaClient = (): PrismaClient => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'production' 
      ? ['error', 'warn'] 
      : ['query', 'info', 'warn', 'error'],
  });

  // Keep a single PrismaClient type across environments to avoid union type issues.
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
