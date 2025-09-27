import '../vercel-env';
import serverless from 'serverless-http';
import app from '../src/server';

// Export the serverless function
export default serverless(app);

// Configure the function with appropriate timeout settings
export const config = {
  maxDuration: 10, // 10 seconds - functions should respond quickly
};