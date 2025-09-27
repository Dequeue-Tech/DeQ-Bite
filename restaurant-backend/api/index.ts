// Add debugging
console.log('Starting api/index.ts at:', new Date().toISOString());

// Import environment variables first
import '../vercel-env';
console.log('Environment variables loaded at:', new Date().toISOString());

// Import serverless-http
import serverless from 'serverless-http';
console.log('serverless-http imported at:', new Date().toISOString());

// Import app with debugging
console.log('About to import app from ../src/server at:', new Date().toISOString());
import app from '../src/server';
console.log('App imported successfully at:', new Date().toISOString());

// Export the serverless function
console.log('Creating serverless function at:', new Date().toISOString());
const handler = serverless(app, {
  binary: ['*/*'],
});

console.log('Serverless function created at:', new Date().toISOString());

// Add timing information to the handler
const timedHandler = async (req: any, res: any) => {
  console.log('Handler called at:', new Date().toISOString());
  const startTime = Date.now();
  
  try {
    await handler(req, res);
    const endTime = Date.now();
    console.log('Handler completed at:', new Date().toISOString(), 'Duration:', endTime - startTime, 'ms');
  } catch (error) {
    const endTime = Date.now();
    console.error('Handler error at:', new Date().toISOString(), 'Duration:', endTime - startTime, 'ms', 'Error:', error);
    throw error;
  }
};

// Export default
export default timedHandler;

// Configure the function with appropriate timeout settings
export const config = {
  maxDuration: 10, // Increased timeout for debugging
  memory: 512,
};

console.log('api/index.ts initialization complete at:', new Date().toISOString());