import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Check if we're in a serverless environment (Vercel)
const isServerless = process.env['VERCEL'];

// Create a function to get the Prisma client instance
// This ensures lazy initialization and prevents blocking during module import
export const getPrismaClient = (() => {
  let prisma: PrismaClient | null = null;
  
  return () => {
    if (!prisma) {
      prisma = new PrismaClient({
        log: isServerless ? ['error', 'warn'] : ['query', 'info', 'warn', 'error'],
        // Optimize for serverless environments
        datasources: {
          db: {
            url: isServerless 
              ? `${process.env.DATABASE_URL}?connection_limit=1&pool_timeout=0` 
              : process.env.DATABASE_URL
          }
        }
      });
      
      // In non-serverless environments, we might want to handle connection events
      if (!isServerless) {
        // @ts-ignore - TypeScript might not recognize this event type
        prisma.$on('beforeExit', async () => {
          logger.info('Prisma client is about to exit');
        });
      }
    }
    
    return prisma;
  };
})();

// For backward compatibility, we still export a direct instance
// but only initialize it when needed
let prismaInstance: PrismaClient | null = null;

declare global {
  var __prisma: PrismaClient | undefined;
}

if (isServerless) {
  // In serverless environments, use the lazy initialization approach
  prismaInstance = getPrismaClient();
} else {
  // In development/production environments, use global prisma instance
  if (process.env.NODE_ENV === 'production') {
    prismaInstance = getPrismaClient();
  } else {
    if (!global.__prisma) {
      global.__prisma = getPrismaClient();
    }
    prismaInstance = global.__prisma;
  }
}

export const connectDatabase = async () => {
  try {
    // In serverless environments, we don't need to explicitly connect
    // Prisma will handle connections automatically
    if (!isServerless) {
      const prisma = getPrismaClient();
      await prisma.$connect();
      logger.info('✅ Database connected successfully');
    } else {
      // In serverless environments, just log that we're using Prisma
      logger.info('✅ Using Prisma client in serverless environment');
    }
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const disconnectDatabase = async () => {
  try {
    // In serverless environments, we don't need to explicitly disconnect
    // Prisma will handle connections automatically
    if (!isServerless) {
      const prisma = getPrismaClient();
      await prisma.$disconnect();
      logger.info('✅ Database disconnected successfully');
    }
  } catch (error) {
    logger.error('❌ Database disconnection failed:', error);
    throw error;
  }
};

// Export the prisma instance for backward compatibility
export const prisma = prismaInstance!;