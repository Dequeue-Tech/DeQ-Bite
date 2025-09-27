// Ultra minimal test
import serverless from 'serverless-http';
import express from 'express';

const app = express();

app.get('/ultra-minimal', (_req, res) => {
  res.status(200).json({ 
    message: 'Ultra minimal test working!',
    timestamp: new Date().toISOString()
  });
});

app.get('/ultra-health', (_req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: 'ultra-minimal-v1'
  });
});

export default serverless(app);

export const config = {
  maxDuration: 3, // Very short timeout
  memory: 512,
};