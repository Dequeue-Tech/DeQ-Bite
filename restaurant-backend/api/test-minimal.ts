import serverless from 'serverless-http';
import express from 'express';

const app = express();

app.get('/test-minimal', (_req, res) => {
  res.status(200).json({ 
    message: 'Minimal test working!',
    timestamp: new Date().toISOString()
  });
});

export default serverless(app);

export const config = {
  maxDuration: 5,
  memory: 512,
};