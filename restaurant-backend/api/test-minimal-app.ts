// Test with a minimal Express app that imports our server
console.log('test-minimal-app.ts: Starting at:', new Date().toISOString());

import serverless from 'serverless-http';
console.log('test-minimal-app.ts: serverless-http imported at:', new Date().toISOString());

// Import our server but don't do anything with it except create the handler
import app from '../src/server';
console.log('test-minimal-app.ts: App imported at:', new Date().toISOString());

// Add debugging to see when the handler is called and when it completes
const handler = serverless(app, {
  binary: ['*/*'],
});
console.log('test-minimal-app.ts: Serverless function created at:', new Date().toISOString());

const debugHandler = async (event: any, context: any) => {
  console.log('test-minimal-app.ts: Handler called at:', new Date().toISOString());
  
  // Log basic event information
  console.log('test-minimal-app.ts: Event type:', typeof event);
  console.log('test-minimal-app.ts: Event keys:', Object.keys(event || {}).slice(0, 10)); // Only first 10 keys
  
  // Log context information
  console.log('test-minimal-app.ts: Context:', {
    awsRequestId: context.awsRequestId,
    functionName: context.functionName,
    functionVersion: context.functionVersion,
    memoryLimitInMB: context.memoryLimitInMB,
    timeout: context.getRemainingTimeInMillis ? context.getRemainingTimeInMillis() : 'unknown'
  });
  
  try {
    const result = await handler(event, context);
    console.log('test-minimal-app.ts: Handler completed successfully at:', new Date().toISOString());
    return result;
  } catch (error) {
    console.error('test-minimal-app.ts: Handler error at:', new Date().toISOString(), error);
    throw error;
  }
};

export default debugHandler;

export const config = {
  maxDuration: 5,
  memory: 512,
};

console.log('test-minimal-app.ts: Initialization complete at:', new Date().toISOString());