// Simplified database configuration to avoid any potential issues
console.log('Database module loading...');

// Check if we're in a serverless environment (Vercel)
const isServerless = process.env['VERCEL'];
console.log('Serverless environment:', isServerless);

// Create a function to get the Prisma client instance
// This ensures lazy initialization and prevents blocking during module import
export const getPrismaClient = (() => {
  let prisma: any = null; // Use 'any' to avoid TypeScript issues
  
  return () => {
    console.log('getPrismaClient called');
    if (!prisma) {
      console.log('Creating new Prisma client');
      // Dynamically import PrismaClient to avoid issues during module load
      const { PrismaClient } = require('@prisma/client');
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
      
      console.log('Prisma client created');
    }
    
    return prisma;
  };
})();

console.log('Setting up prisma instance...');

// For backward compatibility, we still export a direct instance
// but only initialize it when needed
let prismaInstance: any = null; // Use 'any' to avoid TypeScript issues

declare global {
  var __prisma: any; // Use 'any' to avoid TypeScript issues
}

if (isServerless) {
  // In serverless environments, DO NOT create the instance immediately
  // Let it be created lazily when needed
  prismaInstance = null; // Changed from getPrismaClient() to null
  console.log('Serverless: prismaInstance set to null');
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
  console.log('Non-serverless: prismaInstance set');
}

console.log('Exporting functions...');

// Simplified connect/disconnect functions without logger
export const connectDatabase = async () => {
  try {
    console.log('connectDatabase called');
    // In serverless environments, we don't need to explicitly connect
    // Prisma will handle connections automatically
    if (!isServerless) {
      const prisma = getPrismaClient();
      await prisma.$connect();
      console.log('✅ Database connected successfully');
    } else {
      // In serverless environments, just log that we're using Prisma
      console.log('✅ Using Prisma client in serverless environment');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const disconnectDatabase = async () => {
  try {
    console.log('disconnectDatabase called');
    // In serverless environments, we don't need to explicitly disconnect
    // Prisma will handle connections automatically
    if (!isServerless) {
      const prisma = getPrismaClient();
      await prisma.$disconnect();
      console.log('✅ Database disconnected successfully');
    }
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
    throw error;
  }
};

// Export the prisma instance for backward compatibility
// In serverless environments, this will be null until getPrismaClient() is called
export const prisma = prismaInstance;
console.log('Database module loaded');