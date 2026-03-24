import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { errorHandler } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { attachRestaurant } from '@/middleware/restaurant';
import { optionalAuth } from '@/middleware/auth';
import { attachTenantContext } from '@/middleware/tenantContext';


import authRoutes from '@/routes/auth';
import paymentRoutes from '@/routes/payments';
import invoiceRoutes from '@/routes/invoices';
import pdfRoutes from '@/routes/pdf';
import menuRoutes from '@/routes/menu';
import categoryRoutes from '@/routes/categories';
import tableRoutes from '@/routes/tables';
import orderRoutes from '@/routes/orders';
import couponRoutes from '@/routes/coupons';
import restaurantRoutes from '@/routes/restaurants';
import offerRoutes from '@/routes/offers';
import platformRoutes from '@/routes/platform';
import realtimeRoutes from '@/routes/realtime';
import deliveryRoutes from '@/routes/delivery';
import kotRoutes from '@/modules/kot/kot.routes';
import inventoryRoutes from '@/modules/inventory/inventory.routes';
import crmRoutes from '@/modules/crm/crm.routes';
import analyticsRoutes from '@/modules/analytics/analytics.routes';
import posRoutes from '@/modules/pos/pos.routes';

dotenv.config();

if (process.env.NODE_ENV === 'production') {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    logger.error('Firebase Admin SDK environment variables are not properly configured for production');
  }
}

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL?.replace(/\/$/, ''),
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://bite-delivery.dequeue.co.in',
      'https://de-q-restaurants-frontend.vercel.app',
      'https://bite.dequeue.co.in',
      'https://demo.bite.dequeue.co.in',
    ].filter(Boolean);

    const isAllowedOrigin = (candidate: string) => {
      if (allowedOrigins.includes(candidate)) return true;
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'https:') return false;
        return parsed.hostname === 'bite.dequeue.co.in' || parsed.hostname.endsWith('.bite.dequeue.co.in');
      } catch {
        return false;
      }
    };

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');
    if (isAllowedOrigin(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-restaurant-subdomain', 'x-restaurant-slug'],
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(attachRestaurant);
app.use(optionalAuth);
app.use(attachTenantContext);

app.use(morgan('combined', {
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    },
  },
}));

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'Welcome to the Restaurant Management System API',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/platform', platformRoutes);

// Tenant-scoped routes — accessible via:
//   /api/:restaurantSlug/<resource>   (slug-based)
//   /api/restaurants/:restaurantId/<resource>   (ID-based, params populated via URL extraction in attachRestaurant)
const tenantRouter = express.Router({ mergeParams: true });
tenantRouter.use('/payments', paymentRoutes);
tenantRouter.use('/invoices', invoiceRoutes);
tenantRouter.use('/pdf', pdfRoutes);
tenantRouter.use('/menu', menuRoutes);
tenantRouter.use('/categories', categoryRoutes);
tenantRouter.use('/tables', tableRoutes);
tenantRouter.use('/orders', orderRoutes);
tenantRouter.use('/coupons', couponRoutes);
tenantRouter.use('/restaurants', restaurantRoutes);
tenantRouter.use('/offers', offerRoutes);
tenantRouter.use('/delivery', deliveryRoutes);
tenantRouter.use('/kot', kotRoutes);
tenantRouter.use('/inventory', inventoryRoutes);
tenantRouter.use('/crm', crmRoutes);
tenantRouter.use('/analytics', analyticsRoutes);
tenantRouter.use('/pos', posRoutes);
tenantRouter.use('/', realtimeRoutes);

// More-specific path MUST come before the generic /api/restaurants listing
app.use('/api/restaurants/:restaurantId', tenantRouter);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/:restaurantSlug', tenantRouter);

app.use('/invoices', express.static('public/invoices'));

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
  });
});

app.use(errorHandler);

export default app;
