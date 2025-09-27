import express from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// Simple middleware
app.use(express.json({ limit: '10mb' }));

// Health check endpoint (keep this simple and fast)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Test route
app.get('/test', (_req, res) => {
  res.status(200).json({ message: '✅ Test route working!' });
});

// Root route
app.get('/', (_req, res) => {
  res.status(200).json({ message: 'Welcome to the API' });
});

// Simple API route handlers that dynamically load modules when needed
const handleApiRoute = (routePath: string) => {
  return (req: any, res: any, next: any) => {
    try {
      console.log(`Dynamically requiring route: ${routePath}`);
      const routeModule = require(routePath);
      const router = routeModule.default || routeModule;
      console.log(`Successfully loaded route: ${routePath}`);
      
      // Pass the request to the router
      router(req, res, next);
    } catch (error) {
      console.error(`Failed to load route ${routePath}:`, error);
      res.status(500).json({ error: `Failed to load ${routePath} routes` });
    }
  };
};

// API routes
app.use('/api/auth', handleApiRoute('./routes/auth'));
app.use('/api/payments', handleApiRoute('./routes/payments'));
app.use('/api/orders', handleApiRoute('./routes/orders'));
app.use('/api/invoices', handleApiRoute('./routes/invoices'));
app.use('/api/menu', handleApiRoute('./routes/menu'));
app.use('/api/categories', handleApiRoute('./routes/categories'));
app.use('/api/tables', handleApiRoute('./routes/tables'));

// Simple 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
  });
});

export default app;