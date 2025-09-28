"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.disconnectDatabase = exports.connectDatabase = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
let prisma;
if (process.env.NODE_ENV === 'production') {
    exports.prisma = prisma = new client_1.PrismaClient({
        log: ['error', 'warn'],
    });
}
else {
    if (!global.__prisma) {
        global.__prisma = new client_1.PrismaClient({
            log: ['query', 'info', 'warn', 'error'],
        });
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