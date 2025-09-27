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
});
console.log('api/index.ts: Serverless function created at:', new Date().toISOString());

console.log('api/index.ts: Exporting handler at:', new Date().toISOString());

// Export the serverless function
export default handler;

// Configure the function with appropriate timeout settings
export const config = {
  maxDuration: 10,
  memory: 512,
};

console.log('api/index.ts: Initialization complete at:', new Date().toISOString());