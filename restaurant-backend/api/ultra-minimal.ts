// Ultra minimal test with timing
console.log('Ultra minimal test starting at:', new Date().toISOString());

import serverless from 'serverless-http';
import express from 'express';

console.log('Express app created at:', new Date().toISOString());

const app = express();

app.get('/ultra-minimal', (_req, res) => {
  console.log('Ultra minimal endpoint hit at:', new Date().toISOString());
  res.status(200).json({ 
    message: 'Ultra minimal test working!',
    timestamp: new Date().toISOString()
  });
});

app.get('/ultra-health', (_req, res) => {
  console.log('Ultra health endpoint hit at:', new Date().toISOString());
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: 'ultra-minimal-v1'
  });
});

console.log('Routes configured at:', new Date().toISOString());

const handler = serverless(app);

console.log('Serverless function created at:', new Date().toISOString());

export default handler;

export const config = {
  maxDuration: 10, // Increased for debugging
  memory: 512,
};

console.log('Ultra minimal test initialization complete at:', new Date().toISOString());