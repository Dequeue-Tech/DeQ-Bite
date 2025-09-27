import express from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// Simple middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Minimal server is running'
  });
});

// Test route
app.get('/test', (_req, res) => {
  res.status(200).json({ 
    message: '✅ Minimal test route working!',
    version: 'minimal-v1'
  });
});

// Simple root route
app.get('/', (_req, res) => {
  res.status(200).json({ 
    message: 'Welcome to the minimal API',
    version: 'minimal-v1'
  });
});

export default app;