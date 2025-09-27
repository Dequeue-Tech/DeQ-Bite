import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

const app = express();

// Enable trust proxy for Vercel environment
app.set('trust proxy', 1);

// Security middleware - minimal for serverless
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: false, // Disable HSTS completely for serverless
}));

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  maxAge: 600, // 10 minutes
};

app.use(cors(corsOptions));

// Body parsing middleware - minimal
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Lazy loading implementation - only import routes when needed
const lazyLoadRoute = (routePath: string) => {
  let routeModule: any = null;
  
  return (req: any, res: any, next: any) => {
    // If route module is not loaded yet, load it now
    if (!routeModule) {
      try {
        console.log(`Dynamically importing route: ${routePath}`);
        // Use dynamic import to load the route module
        routeModule = require(routePath).default;
        console.log(`Successfully loaded route: ${routePath}`);
      } catch (error) {
        console.error(`Failed to load route module ${routePath}:`, error);
        return res.status(500).json({ error: `Failed to load ${routePath} routes` });
      }
    }
    
    // Pass control to the loaded route module
    routeModule(req, res, next);
  };
};

// API routes with true lazy loading
app.use('/api/auth', lazyLoadRoute('./routes/auth'));
app.use('/api/payments', lazyLoadRoute('./routes/payments'));
app.use('/api/orders', lazyLoadRoute('./routes/orders'));
app.use('/api/invoices', lazyLoadRoute('./routes/invoices'));
app.use('/api/menu', lazyLoadRoute('./routes/menu'));
app.use('/api/categories', lazyLoadRoute('./routes/categories'));
app.use('/api/tables', lazyLoadRoute('./routes/tables'));

// Static files for invoices
app.use('/invoices', express.static('public/invoices'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Error handling middleware
app.use(errorHandler);

export default app;