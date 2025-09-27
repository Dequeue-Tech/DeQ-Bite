import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';

// Import route modules
import authRoutes from './routes/auth';
import paymentRoutes from './routes/payments';
import orderRoutes from './routes/orders';
import invoiceRoutes from './routes/invoices';
import menuRoutes from './routes/menu';
import categoryRoutes from './routes/categories';
import tableRoutes from './routes/tables';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Check if we're in a serverless environment (Vercel)
const isServerless = process.env['VERCEL'];

// Enable trust proxy for Vercel environment
// This is needed to properly handle X-Forwarded-* headers
app.set('trust proxy', 1);

// Security middleware - optimized for serverless
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  // Disable HSTS in serverless environments to reduce response time
  hsts: !isServerless,
}));

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  // Reduce preflight cache time in serverless for better flexibility
  maxAge: isServerless ? 600 : 86400, // 10 minutes in serverless, 24 hours otherwise
};

// Handle preflight requests properly
app.use(cors(corsOptions));

// Rate limiting - updated configuration to handle Vercel environment
// trust proxy BEFORE rate limit
// Reduce rate limiting strictness in serverless environments
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isServerless ? 200 : 100, // Higher limit for serverless
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' },
  keyGenerator: (req: Request) => {
    // Use ipKeyGenerator to properly handle IPv6 addresses
    return ipKeyGenerator(req.ip || (req.connection ? req.connection.remoteAddress : 'unknown') || 'unknown');
  },
  // Skip rate limiting for health check endpoints
  skip: (req: Request) => {
    return req.path === '/health' || req.path === '/test';
  }
});

app.use(limiter);

// Body parsing middleware - optimized for serverless
// Only parse bodies for POST, PUT, PATCH requests
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    express.json({ limit: '10mb' })(req, res, next);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
  } else {
    next();
  }
});

// Logging - only in non-serverless environments
if (!isServerless) {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
  }));
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// test route
app.get('/test', (_req, res) => {
  res.status(200).json({ message: '✅ Test route working!' });
});

// your existing routes here…
app.get('/', (_req, res) => {
  res.status(200).json({ message: 'Welcome to the API' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tables', tableRoutes);

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

// Graceful shutdown - only in non-serverless environments
if (!isServerless) {
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
}

// Export a function to start the server (for non-serverless environments)
export const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Only start the server if not running in a serverless environment
    if (require.main === module && !isServerless) {
      app.listen(PORT, () => {
        logger.info(`🚀 Server running on port ${PORT}`);
        logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
        logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Only start the server if this file is run directly and not in a serverless environment
if (require.main === module && !isServerless) {
  startServer();
}

export default app;