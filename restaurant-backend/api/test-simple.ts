// Simple test with our Express app but minimal configuration
console.log('test-simple.ts: Starting at:', new Date().toISOString());

import serverless from 'serverless-http';
console.log('test-simple.ts: serverless-http imported at:', new Date().toISOString());

// Create a very simple Express app without importing our modules
import express from 'express';
console.log('test-simple.ts: express imported at:', new Date().toISOString());

const app = express();
console.log('test-simple.ts: Express app created at:', new Date().toISOString());

app.get('/test-simple', (_req, res) => {
  console.log('test-simple.ts: /test-simple endpoint hit at:', new Date().toISOString());
  res.status(200).json({ 
    message: 'Simple test working!',
    timestamp: new Date().toISOString()
  });
});

console.log('test-simple.ts: Route configured at:', new Date().toISOString());

const handler = serverless(app);
console.log('test-simple.ts: Serverless function created at:', new Date().toISOString());

export default handler;

export const config = {
  maxDuration: 5,
  memory: 512,
};

console.log('test-simple.ts: Initialization complete at:', new Date().toISOString());