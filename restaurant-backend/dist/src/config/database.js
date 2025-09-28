"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.disconnectDatabase = exports.connectDatabase = exports.getPrismaClient = void 0;
console.log('Database module loading...');
const isServerless = process.env['VERCEL'];
console.log('Serverless environment:', isServerless);
exports.getPrismaClient = (() => {
    let prisma = null;
    return () => {
        console.log('getPrismaClient called');
        if (!prisma) {
            console.log('Creating new Prisma client');
            const { PrismaClient } = require('@prisma/client');
            prisma = new PrismaClient({
                log: isServerless ? ['error', 'warn'] : ['query', 'info', 'warn', 'error'],
                datasources: {
                    db: {
                        url: isServerless
                            ? `${process.env.DATABASE_URL}?connection_limit=1&pool_timeout=0`
                            : process.env.DATABASE_URL
                    }
                }
            });
            if (!isServerless) {
                prisma.$on('connect', () => {
                    console.log('Prisma client connected');
                });
                prisma.$on('disconnect', () => {
                    console.log('Prisma client disconnected');
                });
            }
            console.log('Prisma client created');
        }
        return prisma;
    };
})();
console.log('Setting up prisma instance...');
let prismaInstance = null;
if (isServerless) {
    prismaInstance = null;
    console.log('Serverless: prismaInstance set to null');
}
else {
    if (process.env.NODE_ENV === 'production') {
        prismaInstance = (0, exports.getPrismaClient)();
    }
    else {
        if (!global.__prisma) {
            global.__prisma = (0, exports.getPrismaClient)();
        }
        prismaInstance = global.__prisma;
    }
    console.log('Non-serverless: prismaInstance set');
}
console.log('Exporting functions...');
const connectDatabase = async () => {
    try {
        console.log('connectDatabase called');
        if (!isServerless) {
            const prisma = (0, exports.getPrismaClient)();
            await prisma.$connect();
            console.log('✅ Database connected successfully');
        }
        else {
            console.log('✅ Using Prisma client in serverless environment');
        }
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
};
exports.connectDatabase = connectDatabase;
const disconnectDatabase = async () => {
    try {
        console.log('disconnectDatabase called');
        if (!isServerless) {
            const prisma = (0, exports.getPrismaClient)();
            await prisma.$disconnect();
            console.log('✅ Database disconnected successfully');
        }
    }
    catch (error) {
        console.error('❌ Database disconnection failed:', error);
        throw error;
    }
};
exports.disconnectDatabase = disconnectDatabase;
exports.prisma = prismaInstance;
console.log('Database module loaded');
//# sourceMappingURL=database.js.map