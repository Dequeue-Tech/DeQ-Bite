import '../vercel-env';
import serverless from 'serverless-http';
import app from '../src/server';

// Export the serverless function
export default serverless(app, {
  // Configure serverless-http to handle binary media types properly
  binary: ['*/*'],
});

// Configure the function with appropriate timeout settings
export const config = {
  maxDuration: 10, // 10 seconds - functions should respond quickly
  // Memory allocation for the function
  memory: 512,
};
