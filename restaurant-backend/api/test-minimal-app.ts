// Test with a minimal Express app that imports our server
console.log('test-minimal-app.ts: Starting at:', new Date().toISOString());

import serverless from 'serverless-http';
console.log('test-minimal-app.ts: serverless-http imported at:', new Date().toISOString());

// Import our server but don't do anything with it except create the handler
import app from '../src/server';
console.log('test-minimal-app.ts: App imported at:', new Date().toISOString());

const handler = serverless(app);
console.log('test-minimal-app.ts: Serverless function created at:', new Date().toISOString());

export default handler;

export const config = {
  maxDuration: 5,
  memory: 512,
};

console.log('test-minimal-app.ts: Initialization complete at:', new Date().toISOString());