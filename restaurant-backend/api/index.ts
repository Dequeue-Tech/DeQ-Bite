// Add debugging
console.log('Starting api/index.ts');

// Import environment variables first
import '../vercel-env';
console.log('Environment variables loaded');

// Import serverless-http
import serverless from 'serverless-http';
console.log('serverless-http imported');

// Import app with debugging
console.log('About to import app from ../src/server');
import app from '../src/server';
console.log('App imported successfully');

// Export the serverless function
console.log('Creating serverless function');
const handler = serverless(app, {
  binary: ['*/*'],
});

console.log('Serverless function created');

// Export default
export default handler;

// Configure the function with appropriate timeout settings
export const config = {
  maxDuration: 5, // Reduced timeout for testing
  memory: 512,
};

console.log('api/index.ts initialization complete');