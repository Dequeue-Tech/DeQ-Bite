"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.disconnectDatabase = exports.connectDatabase = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const createPrismaClient = () => {
    const client = new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'production'
            ? ['error', 'warn']
            : ['query', 'info', 'warn', 'error'],
    });
    const databaseUrl = process.env.DATABASE_URL || '';
    if (databaseUrl.startsWith('prisma+')) {
        try {
            const { withAccelerate } = require('@prisma/extension-accelerate');
            return client.$extends(withAccelerate());
        }
        catch (error) {
            logger_1.logger.warn('Prisma Accelerate requested but @prisma/extension-accelerate is not installed. Falling back to regular Prisma client.');
            return client;
        }
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