// Add debugging
console.log('Starting api/index.ts at:', new Date().toISOString());

// Import environment variables first
import '../vercel-env';
import serverless from 'serverless-http';
import app from '../src/server';

// Export the serverless function
export default serverless(app, {
  binary: ['*/*'],
});

// Configure the function with appropriate timeout settings
export const config = {
  maxDuration: 10,
  memory: 512,
};

console.log('api/index.ts initialization complete at:', new Date().toISOString());