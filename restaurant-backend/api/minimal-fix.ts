// Minimal fix for content-length issue
console.log('minimal-fix.ts: Starting at:', new Date().toISOString());

import serverless from 'serverless-http';
import express from 'express';

const app = express();

// Simple middleware to handle GET requests with content-length
app.use((req, _res, next) => {
  console.log('minimal-fix.ts: Request method:', req.method);
  console.log('minimal-fix.ts: Content-Length:', req.headers['content-length']);
  
  // For GET requests, explicitly set body to empty to avoid parsing issues
  if (req.method === 'GET') {
    req.body = {};
  }
  
  next();
});

// Simple route
app.get('/minimal-fix', (req, res) => {
  console.log('minimal-fix.ts: Route hit');
  res.status(200).json({ 
    message: 'Minimal fix working!',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: any, req: any, _res: any, next: any) => {
  console.log('minimal-fix.ts: Error:', err.message);
  
  // Handle BadRequestError specifically
  if (err.message?.includes('request size did not match content length')) {
    console.log('minimal-fix.ts: Handling BadRequestError');
    req.body = {};
    return next();
  }
  
  next(err);
});

const handler = serverless(app);

export default handler;

export const config = {
  maxDuration: 5,
  memory: 512,
};

console.log('minimal-fix.ts: Initialization complete');