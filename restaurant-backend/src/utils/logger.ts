import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, service }) => {
    return `${timestamp} [${level.toUpperCase()}]${service ? ` [${service}]` : ''}: ${message}${stack ? '\n' + stack : ''}`;
  })
);

// Check if we're in a serverless environment (Vercel)
const isServerless = process.env['VERCEL'] || process.env['NOW_REGION'];

// Create logs directory if it doesn't exist (only in non-serverless environments)
const logsDir = path.join(process.cwd(), 'logs');
if (!isServerless && !fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (error) {
    // Ignore errors in serverless environments
  }
}

// Configure transports based on environment
const transports: winston.transport[] = [
  // Always log to console
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

// Only add file transports if we're not in a serverless environment
if (!isServerless) {
  try {
    transports.push(
      // Write error logs to file
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      // Write all logs to file
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    );
  } catch (error) {
    // Ignore errors in serverless environments
  }
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'restaurant-backend' },
  transports,
});