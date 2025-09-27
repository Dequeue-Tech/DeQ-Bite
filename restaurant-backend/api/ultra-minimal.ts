// Ultra minimal test with timing
console.log('Ultra minimal test starting at:', new Date().toISOString());

// Ultra minimal test - no imports from our codebase
import serverless from 'serverless-http';
import express from 'express';

const app = express();

app.get('/ultra-minimal', (_req, res) => {
  res.status(200).json({ 
    message: 'Ultra minimal test working!',
    timestamp: new Date().toISOString()
  });
});

export default serverless(app);

export const config = {
  maxDuration: 5,
  memory: 512,
};

console.log('Ultra minimal test initialization complete at:', new Date().toISOString());