import '../vercel-env';
import serverless from 'serverless-http';
import app from '../src/server';

// Export the serverless function
export default serverless(app, {
  // Configure serverless-http to handle binary media types properly
  binary: ['*/*'],
  // Add request/response transformation for better performance
  request: (request: any) => {
    // Ensure request is properly formatted for serverless
    return request;
  },
  response: (response: any) => {
    // Ensure response is properly formatted for serverless
    return response;
  }
});

// Configure the function with appropriate timeout settings
export const config = {
  maxDuration: 10, // 10 seconds - functions should respond quickly
  // Memory allocation for the function
  memory: 512,
};