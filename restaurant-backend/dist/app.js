"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const errorHandler_1 = require("./middleware/errorHandler");
const logger_1 = require("./utils/logger");
const restaurant_1 = require("./middleware/restaurant");
const auth_1 = require("./middleware/auth");
const tenantContext_1 = require("./middleware/tenantContext");
const auth_2 = __importDefault(require("./routes/auth"));
const payments_1 = __importDefault(require("./routes/payments"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const pdf_1 = __importDefault(require("./routes/pdf"));
const menu_1 = __importDefault(require("./routes/menu"));
const categories_1 = __importDefault(require("./routes/categories"));
const tables_1 = __importDefault(require("./routes/tables"));
const orders_1 = __importDefault(require("./routes/orders"));
const coupons_1 = __importDefault(require("./routes/coupons"));
const restaurants_1 = __importDefault(require("./routes/restaurants"));
const offers_1 = __importDefault(require("./routes/offers"));
const platform_1 = __importDefault(require("./routes/platform"));
const realtime_1 = __importDefault(require("./routes/realtime"));
const delivery_1 = __importDefault(require("./routes/delivery"));
const kot_routes_1 = __importDefault(require("./modules/kot/kot.routes"));
const inventory_routes_1 = __importDefault(require("./modules/inventory/inventory.routes"));
const crm_routes_1 = __importDefault(require("./modules/crm/crm.routes"));
const analytics_routes_1 = __importDefault(require("./modules/analytics/analytics.routes"));
const pos_routes_1 = __importDefault(require("./modules/pos/pos.routes"));
dotenv_1.default.config();
if (process.env.NODE_ENV === 'production') {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        logger_1.logger.error('Firebase Admin SDK environment variables are not properly configured for production');
    }
}
const app = (0, express_1.default)();
app.set('trust proxy', 1);
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
const corsOptions = {
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
            'https://bite-test.dequeue.co.in',
            'https://demo.bite.dequeue.co.in',
        ].filter(Boolean);
        const isAllowedOrigin = (candidate) => {
            if (allowedOrigins.includes(candidate))
                return true;
            try {
                const parsed = new URL(candidate);
                const hostname = parsed.hostname.toLowerCase();
                const isLocalDevHost = (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') &&
                    (parsed.protocol === 'http:' || parsed.protocol === 'https:');
                const isAllowedVercelFrontend = parsed.protocol === 'https:' &&
                    (hostname === 'de-q-restaurants-frontend.vercel.app' || hostname.startsWith('de-q-restaurants-frontend-')) &&
                    hostname.endsWith('.vercel.app');
                if (isLocalDevHost)
                    return true;
                if (isAllowedVercelFrontend)
                    return true;
                if (parsed.protocol !== 'https:')
                    return false;
                return hostname === 'dequeue.co.in' || hostname.endsWith('.dequeue.co.in');
            }
            catch {
                return false;
            }
        };
        if (!origin)
            return callback(null, true);
        const normalizedOrigin = origin.replace(/\/$/, '');
        if (isAllowedOrigin(normalizedOrigin)) {
            return callback(null, true);
        }
        console.warn(`CORS blocked request from origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-restaurant-subdomain', 'x-restaurant-slug'],
};
app.use((0, cors_1.default)(corsOptions));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: {
        error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(restaurant_1.attachRestaurant);
app.use(auth_1.optionalAuth);
app.use(tenantContext_1.attachTenantContext);
app.use((0, morgan_1.default)('combined', {
    stream: {
        write: (message) => {
            logger_1.logger.info(message.trim());
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
app.use('/api/auth', auth_2.default);
app.use('/api/platform', platform_1.default);
const tenantRouter = express_1.default.Router({ mergeParams: true });
tenantRouter.use('/payments', payments_1.default);
tenantRouter.use('/invoices', invoices_1.default);
tenantRouter.use('/pdf', pdf_1.default);
tenantRouter.use('/menu', menu_1.default);
tenantRouter.use('/categories', categories_1.default);
tenantRouter.use('/tables', tables_1.default);
tenantRouter.use('/orders', orders_1.default);
tenantRouter.use('/coupons', coupons_1.default);
tenantRouter.use('/restaurants', restaurants_1.default);
tenantRouter.use('/offers', offers_1.default);
tenantRouter.use('/delivery', delivery_1.default);
tenantRouter.use('/kot', kot_routes_1.default);
tenantRouter.use('/inventory', inventory_routes_1.default);
tenantRouter.use('/crm', crm_routes_1.default);
tenantRouter.use('/analytics', analytics_routes_1.default);
tenantRouter.use('/pos', pos_routes_1.default);
tenantRouter.use('/', realtime_1.default);
app.use('/api/restaurants/:restaurantId', tenantRouter);
app.use('/api/restaurants', restaurants_1.default);
app.use('/api/:restaurantSlug', tenantRouter);
app.use('/invoices', express_1.default.static('public/invoices'));
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
    });
});
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map