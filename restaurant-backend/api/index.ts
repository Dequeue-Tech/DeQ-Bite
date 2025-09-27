import '../vercel-env';
import serverless from 'serverless-http';
import app from '../src/server';

// Export the serverless function
export default serverless(app);

// Optional: Add a warmup endpoint to keep the function warm
export const config = {
  maxDuration: 300, // 5 minutes
};