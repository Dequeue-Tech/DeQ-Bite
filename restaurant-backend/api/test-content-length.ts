// Test specifically for content-length issues
console.log('Content-length test starting at:', new Date().toISOString());

import serverless from 'serverless-http';
import express from 'express';

const app = express();

// Add middleware to handle content-length issues
app.use((req, _res, next) => {
  console.log('Content-length test: Request middleware hit at:', new Date().toISOString());
  console.log('Content-length test: Request method:', req.method);
  console.log('Content-length test: Request headers:', req.headers);
  
  // For GET requests, explicitly set body to empty to avoid parsing issues
  if (req.method === 'GET') {
    req.body = {};
  }
  
  next();
});

app.get('/test-content-length', (req, res) => {
  console.log('Content-length test endpoint hit at:', new Date().toISOString());
  
  const contentLength = req.headers['content-length'];
  console.log('Content-length test: Content-Length header:', contentLength);
  
  res.status(200).json({ 
    message: 'Content-length test working!',
    contentLength: contentLength || 'none',
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: any, req: any, _res: any, next: any) => {
  console.log('Content-length test: Error middleware hit at:', new Date().toISOString());
  console.log('Content-length test: Error:', err.message);
  
  // Handle BadRequestError specifically
  if (err.message?.includes('request size did not match content length')) {
    console.log('Content-length test: Handling BadRequestError');
    req.body = {};
    return next(); // Continue processing
  }
  
  next(err);
});

const handler = serverless(app, {
  request: (request: any) => {
    console.log('Content-length test: Processing request at:', new Date().toISOString());
    return request;
  },
  response: (response: any) => {
    console.log('Content-length test: Processing response at:', new Date().toISOString());
    return response;
  }
});

export default handler;

export const config = {
  maxDuration: 5,
  memory: 512,
};

console.log('Content-length test initialization complete at:', new Date().toISOString());