"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.disconnectDatabase = exports.connectDatabase = void 0;
const client_1 = require("@prisma/client");
const extension_accelerate_1 = require("@prisma/extension-accelerate");
const logger_1 = require("../utils/logger");
const createPrismaClient = () => {
    const shouldLogQueries = process.env['LOG_SLOW_QUERIES'] !== 'false';
    const slowQueryMs = Number(process.env['SLOW_QUERY_MS'] || 200);
    const log = process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['query', 'info', 'warn', 'error'];
    if (shouldLogQueries) {
        log.push({ emit: 'event', level: 'query' });
    }
    let client = new client_1.PrismaClient({ log });
    if (shouldLogQueries && typeof client.$on === 'function') {
        client.$on('query', (e) => {
            if (e.duration >= slowQueryMs) {
                const includeParams = process.env['LOG_SLOW_QUERY_PARAMS'] === 'true';
                logger_1.logger.warn('Slow query detected', {
                    durationMs: e.duration,
                    query: e.query,
                    ...(includeParams ? { params: e.params } : {}),
                    target: e.target,
                });
            }
        });
    }
    const databaseUrl = process.env.DATABASE_URL || '';
    if (databaseUrl.startsWith('prisma+')) {
        client = client.$extends((0, extension_accelerate_1.withAccelerate)());
    }
    return client;
};
let prisma;
if (process.env.NODE_ENV === 'production') {
    exports.prisma = prisma = createPrismaClient();
}
else {
    if (!global.__prisma) {
        global.__prisma = createPrismaClient();
    }
    exports.prisma = prisma = global.__prisma;
}
const connectDatabase = async () => {
    try {
        await prisma.$connect();
        logger_1.logger.info('✅ Database connected successfully');
    }
    catch (error) {
        logger_1.logger.error('❌ Database connection failed:', error);
        throw error;
    }
};
exports.connectDatabase = connectDatabase;
const disconnectDatabase = async () => {
    try {
        await prisma.$disconnect();
        logger_1.logger.info('✅ Database disconnected successfully');
    }
    catch (error) {
        logger_1.logger.error('❌ Database disconnection failed:', error);
        throw error;
    }
};
exports.disconnectDatabase = disconnectDatabase;
//# sourceMappingURL=database.js.map