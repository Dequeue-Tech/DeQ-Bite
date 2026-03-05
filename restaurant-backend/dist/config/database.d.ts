import { PrismaClient } from '@prisma/client';
declare const createPrismaClient: () => PrismaClient;
declare let prisma: ReturnType<typeof createPrismaClient>;
declare global {
    var __prisma: ReturnType<typeof createPrismaClient> | undefined;
}
export declare const connectDatabase: () => Promise<void>;
export declare const disconnectDatabase: () => Promise<void>;
export { prisma };
//# sourceMappingURL=database.d.ts.map