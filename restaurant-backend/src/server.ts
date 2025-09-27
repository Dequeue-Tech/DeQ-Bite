console.log('server.ts: Starting module load at:', new Date().toISOString());

import express from 'express';
import dotenv from 'dotenv';

console.log('server.ts: Core modules imported at:', new Date().toISOString());

// Load environment variables
dotenv.config();
console.log('server.ts: Environment variables loaded at:', new Date().toISOString());

const app = express();
console.log('server.ts: Express app created at:', new Date().toISOString());

// Simple middleware - no complex middleware that might keep connections open
app.use(express.json({ limit: '10mb' }));
console.log('server.ts: Middleware configured at:', new Date().toISOString());

// Health check endpoint (keep this simple and fast)
app.get('/health', (_req, res) => {
  console.log('server.ts: /health endpoint hit at:', new Date().toISOString());
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Test route
app.get('/test', (_req, res) => {
  console.log('server.ts: /test endpoint hit at:', new Date().toISOString());
  res.status(200).json({ message: '✅ Test route working!' });
});

// Root route
app.get('/', (_req, res) => {
  console.log('server.ts: / endpoint hit at:', new Date().toISOString());
  res.status(200).json({ message: 'Welcome to the API' });
});

// Add a special endpoint to help debug the timeout issue
app.get('/debug-timeout', (_req, res) => {
  console.log('server.ts: /debug-timeout endpoint hit at:', new Date().toISOString());
  
  // Try to check for active handles
  try {
    if ((process as any)._getActiveHandles) {
      const handles = (process as any)._getActiveHandles();
      console.log('server.ts: Active handles count:', handles.length);
      // Log first few handles for debugging
      handles.slice(0, 5).forEach((handle: any, index: number) => {
        console.log(`server.ts: Handle ${index}:`, handle.constructor?.name || typeof handle);
      });
    }
    
    if ((process as any)._getActiveRequests) {
      const requests = (process as any)._getActiveRequests();
      console.log('server.ts: Active requests count:', requests.length);
    }
  } catch (error) {
    console.log('server.ts: Error checking handles:', error);
  }
  
  res.status(200).json({ 
    message: 'Debug timeout endpoint working!',
    timestamp: new Date().toISOString()
  });
});

// Simple 404 handler
app.use((req, res) => {
  console.log('server.ts: 404 handler hit at:', new Date().toISOString());
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
  });
});

console.log('server.ts: Server setup complete at:', new Date().toISOString());

export default app;

console.log('server.ts: Module export complete at:', new Date().toISOString());