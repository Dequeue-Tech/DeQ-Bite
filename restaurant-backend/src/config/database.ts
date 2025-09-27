import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Check if we're in a serverless environment (Vercel)
const isServerless = process.env['VERCEL'];

let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

if (isServerless) {
  // In serverless environments, always create a new PrismaClient
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  // In development/production environments, use global prisma instance
  if (process.env.NODE_ENV === 'production') {
    prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
  } else {
    if (!global.__prisma) {
      global.__prisma = new PrismaClient({
        log: ['query', 'info', 'warn', 'error'],
      });
    }
    prisma = global.__prisma;
  }
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