// Truly minimal index file to isolate the timeout issue
console.log('minimal-index.ts: Starting at:', new Date().toISOString());

import serverless from 'serverless-http';
import express from 'express';

const app = express();

// Simple route
app.get('/', (_req, res) => {
  console.log('minimal-index.ts: Root route hit');
  res.status(200).json({ 
    message: 'Minimal index working!',
    timestamp: new Date().toISOString()
  });
});

// Simple health check
app.get('/health', (_req, res) => {
  console.log('minimal-index.ts: Health route hit');
  res.status(200).json({ 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

const handler = serverless(app);

export default handler;

export const config = {
  maxDuration: 5,
  memory: 512,
};

console.log('minimal-index.ts: Initialization complete');