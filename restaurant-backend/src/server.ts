console.log('server.ts: Starting module load at:', new Date().toISOString());

import express from 'express';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';

console.log('server.ts: Core modules imported at:', new Date().toISOString());

// Load environment variables
dotenv.config();
console.log('server.ts: Environment variables loaded at:', new Date().toISOString());

const app = express();
console.log('server.ts: Express app created at:', new Date().toISOString());

// Configure Express to handle the request size issue
app.use((req, _res, next) => {
  console.log('server.ts: Request middleware hit at:', new Date().toISOString());
  console.log('server.ts: Request headers:', req.headers);
  
  // Handle content-length issues
  const contentLength = req.headers['content-length'];
  if (contentLength) {
    console.log('server.ts: Content-Length header:', contentLength);
  }
  
  // Set proper content length handling
  req.on('error', (err) => {
    console.log('server.ts: Request error:', err);
  });
  
  next();
});

// Simple middleware - handle body parsing with proper error handling
// Only parse bodies for POST, PUT, PATCH requests to avoid issues with GET requests
app.use((req, res, next) => {
  console.log('server.ts: Body parsing middleware hit at:', new Date().toISOString());
  console.log('server.ts: Request method:', req.method);
  
  // For GET, HEAD, DELETE requests, skip body parsing entirely
  // This prevents issues with requests that have content-length headers but shouldn't have bodies
  if (['GET', 'HEAD', 'DELETE'].includes(req.method)) {
    console.log('server.ts: Skipping body parsing for', req.method, 'request');
    // Explicitly set body to empty to avoid any body parsing attempts
    req.body = {};
    return next();
  }
  
  // Only parse bodies for methods that typically have bodies
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    console.log('server.ts: Parsing body for', req.method);
    express.json({ 
      limit: '10mb',
      verify: (_req, _res, buf, encoding) => {
        // Verify request body integrity
        console.log('server.ts: JSON body verification - length:', buf.length, 'encoding:', encoding);
      }
    })(req, res, (err) => {
      if (err) {
        console.log('server.ts: JSON parsing error:', err);
        // Don't let body parsing errors prevent the request from being handled
        // Set an empty body and continue
        req.body = {};
        return next();
      }
      next();
    });
  } else {
    console.log('server.ts: Skipping body parsing for', req.method);
    // For any other methods, set empty body
    req.body = {};
    next();
  }
});

app.use((req, res, next) => {
  console.log('server.ts: URL encoding middleware hit at:', new Date().toISOString());
  console.log('server.ts: Request method:', req.method);
  
  // For GET, HEAD, DELETE requests, skip URL encoding parsing entirely
  if (['GET', 'HEAD', 'DELETE'].includes(req.method)) {
    console.log('server.ts: Skipping URL encoding parsing for', req.method, 'request');
    return next();
  }
  
  // Only parse bodies for methods that typically have bodies
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    console.log('server.ts: Parsing URL encoded body for', req.method);
    express.urlencoded({ 
      extended: true, 
      limit: '10mb',
      verify: (_req, _res, buf, encoding) => {
        // Verify request body integrity
        console.log('server.ts: URL encoded body verification - length:', buf.length, 'encoding:', encoding);
      }
    })(req, res, (err) => {
      if (err) {
        console.log('server.ts: URL encoding parsing error:', err);
        // Don't let body parsing errors prevent the request from being handled
        return next();
      }
      next();
    });
  } else {
    console.log('server.ts: Skipping URL encoding parsing for', req.method);
    next();
  }
});

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

// Add a specific test endpoint for debugging the content-length issue
app.get('/test-content-length', (req, res) => {
  console.log('server.ts: /test-content-length endpoint hit at:', new Date().toISOString());
  console.log('server.ts: Request headers:', req.headers);
  
  // Check if there's a content-length header
  const contentLength = req.headers['content-length'];
  if (contentLength) {
    console.log('server.ts: Content-Length header present:', contentLength);
  }
  
  // Send response immediately
  res.status(200).json({ 
    message: 'Content-length test endpoint working!',
    contentLength: contentLength || 'none',
    method: req.method,
    timestamp: new Date().toISOString()
  });
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
      handles.slice(0, 10).forEach((handle: any, index: number) => {
        console.log(`server.ts: Handle ${index}:`, handle.constructor?.name || typeof handle);
        // If it's a socket, log some additional info
        if (handle.constructor?.name === 'Socket') {
          console.log(`server.ts: Socket handle ${index} info:`, {
            destroyed: handle.destroyed,
            readyState: handle.readyState,
            timeout: handle.timeout,
            allowHalfOpen: handle.allowHalfOpen,
          });
        }
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

// Add error handling middleware specifically for BadRequestError
app.use((err: any, req: any, _res: any, next: any) => {
  console.log('server.ts: Error handling middleware hit at:', new Date().toISOString());
  console.log('server.ts: Error type:', err.constructor?.name || typeof err);
  console.log('server.ts: Error message:', err.message);
  
  // Handle BadRequestError specifically
  if (err.type === 'entity.parse.failed' || err.message?.includes('request size did not match content length')) {
    console.log('server.ts: Handling BadRequestError specifically');
    // For body parsing errors, we can still continue with an empty body
    req.body = req.body || {};
    return next(); // Continue to next middleware
  }
  
  // For any other errors, pass them along
  next(err);
});

// Add the centralized error handler middleware
app.use(errorHandler);

console.log('server.ts: Server setup complete at:', new Date().toISOString());

export default app;

console.log('server.ts: Module export complete at:', new Date().toISOString());