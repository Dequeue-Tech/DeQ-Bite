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
const database_1 = require("./config/database");
const auth_1 = __importDefault(require("./routes/auth"));
const payments_1 = __importDefault(require("./routes/payments"));
const orders_1 = __importDefault(require("./routes/orders"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const menu_1 = __importDefault(require("./routes/menu"));
const categories_1 = __importDefault(require("./routes/categories"));
const tables_1 = __importDefault(require("./routes/tables"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:5174',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
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
app.use('/api/auth', auth_1.default);
app.use('/api/payments', payments_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/invoices', invoices_1.default);
app.use('/api/menu', menu_1.default);
app.use('/api/categories', categories_1.default);
app.use('/api/tables', tables_1.default);
app.use('/invoices', express_1.default.static('public/invoices'));
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
    });
});
app.use(errorHandler_1.errorHandler);
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});
async function startServer() {
    try {
        await (0, database_1.connectDatabase)();
        app.listen(PORT, () => {
            logger_1.logger.info(`🚀 Server running on port ${PORT}`);
            logger_1.logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
            logger_1.logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
exports.default = app;
//# sourceMappingURL=server.js.map