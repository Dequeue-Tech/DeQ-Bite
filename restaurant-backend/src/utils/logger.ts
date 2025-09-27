import winston from 'winston';
// import path from 'path';  // Commented out unused imports
// import fs from 'fs';      // Commented out unused imports

console.log('logger.ts: Starting module load');

// Check if we're in a serverless environment (Vercel)
const isServerless = process.env['VERCEL'] || process.env['NOW_REGION'];
console.log('logger.ts: Serverless environment:', isServerless);

// Simplified logger configuration - no file operations in serverless
const transports: winston.transport[] = [
  // Always log to console
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

console.log('logger.ts: Console transport configured');

console.log('logger.ts: Creating logger instance');
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.simple(),
  defaultMeta: { service: 'restaurant-backend' },
  transports,
});
console.log('logger.ts: Logger instance created');

console.log('logger.ts: Module load complete');