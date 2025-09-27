// Simple version with debugging
console.log('api/index.ts: Starting at:', new Date().toISOString());

import '../vercel-env';
console.log('api/index.ts: Environment loaded at:', new Date().toISOString());

import serverless from 'serverless-http';
console.log('api/index.ts: serverless-http imported at:', new Date().toISOString());

import app from '../src/server';
console.log('api/index.ts: App imported at:', new Date().toISOString());

console.log('api/index.ts: Creating serverless function at:', new Date().toISOString());
const handler = serverless(app, {
  binary: ['*/*'],
  // Add request/response transformation for better debugging
  request: (request: any) => {
    console.log('api/index.ts: Processing request at:', new Date().toISOString());
    console.log('api/index.ts: Request method:', request.method);
    console.log('api/index.ts: Request url:', request.url);
    console.log('api/index.ts: Request headers keys:', Object.keys(request.headers || {}));
    return request;
  },
  response: (response: any) => {
    console.log('api/index.ts: Processing response at:', new Date().toISOString());
    console.log('api/index.ts: Response status code:', response.statusCode);
    return response;
  }
});
console.log('api/index.ts: Serverless function created at:', new Date().toISOString());

const debugHandler = async (event: any, context: any) => {
  console.log('api/index.ts: Handler called at:', new Date().toISOString());
  
  // Log basic event information
  console.log('api/index.ts: Event type:', typeof event);
  console.log('api/index.ts: Event keys:', Object.keys(event || {}).slice(0, 10)); // Only first 10 keys
  
  // Log context information
  console.log('api/index.ts: Context:', {
    awsRequestId: context.awsRequestId,
    functionName: context.functionName,
    functionVersion: context.functionVersion,
    memoryLimitInMB: context.memoryLimitInMB,
    timeout: context.getRemainingTimeInMillis ? context.getRemainingTimeInMillis() : 'unknown'
  });
  
  try {
    const result = await handler(event, context);
    console.log('api/index.ts: Handler completed successfully at:', new Date().toISOString());
    return result;
  } catch (error) {
    console.error('api/index.ts: Handler error at:', new Date().toISOString(), error);
    throw error;
  } finally {
    console.log('api/index.ts: Handler finally block at:', new Date().toISOString());
  }
};

console.log('api/index.ts: Exporting handler at:', new Date().toISOString());

// Export the serverless function
export default debugHandler;

// Configure the function with appropriate timeout settings
export const config = {
  maxDuration: 10, // Back to 10 seconds for faster feedback
  memory: 512,
};

console.log('api/index.ts: Initialization complete at:', new Date().toISOString());