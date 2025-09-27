import '../vercel-env';
import serverless from 'serverless-http';
import app from '../src/server-minimal';

// Export the serverless function
export default serverless(app);

// Configure the function with appropriate timeout settings
export const config = {
  maxDuration: 5, // Very short timeout for testing
  memory: 512,
};