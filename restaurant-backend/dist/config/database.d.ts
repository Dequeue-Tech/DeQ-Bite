import { PrismaClient } from '@prisma/client';
declare let prisma: PrismaClient;
declare global {
    var __prisma: PrismaClient | undefined;
}
export declare const connectDatabase: () => Promise<void>;
export declare const disconnectDatabase: () => Promise<void>;
export { prisma };
//# sourceMappingURL=database.d.ts.map