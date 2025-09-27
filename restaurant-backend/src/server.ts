import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
// import { logger } from './utils/logger'; // Comment out unused import

// Load environment variables
dotenv.config();

const app = express();

// Check if we're in a serverless environment (Vercel)
// const isServerless = process.env['VERCEL']; // Comment out unused variable

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

// Health check endpoint (keep this simple)
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

// Lazy load routes only when they are accessed
let authRoutes: any;
let paymentRoutes: any;
let orderRoutes: any;
let invoiceRoutes: any;
let menuRoutes: any;
let categoryRoutes: any;
let tableRoutes: any;

// Use a middleware to load routes on first access
const lazyLoadRoutes = (routeName: string) => {
  return (req: any, res: any, next: any) => {
    try {
      switch (routeName) {
        case 'auth':
          if (!authRoutes) {
            console.log('Lazy loading auth routes');
            authRoutes = require('./routes/auth').default;
          }
          req.lazyRoute = authRoutes;
          break;
        case 'payments':
          if (!paymentRoutes) {
            console.log('Lazy loading payment routes');
            paymentRoutes = require('./routes/payments').default;
          }
          req.lazyRoute = paymentRoutes;
          break;
        case 'orders':
          if (!orderRoutes) {
            console.log('Lazy loading order routes');
            orderRoutes = require('./routes/orders').default;
          }
          req.lazyRoute = orderRoutes;
          break;
        case 'invoices':
          if (!invoiceRoutes) {
            console.log('Lazy loading invoice routes');
            invoiceRoutes = require('./routes/invoices').default;
          }
          req.lazyRoute = invoiceRoutes;
          break;
        case 'menu':
          if (!menuRoutes) {
            console.log('Lazy loading menu routes');
            menuRoutes = require('./routes/menu').default;
          }
          req.lazyRoute = menuRoutes;
          break;
        case 'categories':
          if (!categoryRoutes) {
            console.log('Lazy loading category routes');
            categoryRoutes = require('./routes/categories').default;
          }
          req.lazyRoute = categoryRoutes;
          break;
        case 'tables':
          if (!tableRoutes) {
            console.log('Lazy loading table routes');
            tableRoutes = require('./routes/tables').default;
          }
          req.lazyRoute = tableRoutes;
          break;
      }
      next();
    } catch (error) {
      console.error(`Error loading ${routeName} routes:`, error);
      res.status(500).json({ error: `Failed to load ${routeName} routes` });
    }
  };
};

// API routes with lazy loading
app.use('/api/auth', lazyLoadRoutes('auth'), (req: any, res: any, next: any) => {
  req.lazyRoute(req, res, next);
});

app.use('/api/payments', lazyLoadRoutes('payments'), (req: any, res: any, next: any) => {
  req.lazyRoute(req, res, next);
});

app.use('/api/orders', lazyLoadRoutes('orders'), (req: any, res: any, next: any) => {
  req.lazyRoute(req, res, next);
});

app.use('/api/invoices', lazyLoadRoutes('invoices'), (req: any, res: any, next: any) => {
  req.lazyRoute(req, res, next);
});

app.use('/api/menu', lazyLoadRoutes('menu'), (req: any, res: any, next: any) => {
  req.lazyRoute(req, res, next);
});

app.use('/api/categories', lazyLoadRoutes('categories'), (req: any, res: any, next: any) => {
  req.lazyRoute(req, res, next);
});

app.use('/api/tables', lazyLoadRoutes('tables'), (req: any, res: any, next: any) => {
  req.lazyRoute(req, res, next);
});

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