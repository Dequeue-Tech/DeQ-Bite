import { PrismaClient } from '@prisma/client';
declare const createPrismaClient: () => PrismaClient<{
    log: ("error" | "info" | "query" | "warn")[];
}, "error" | "info" | "query" | "warn", import("@prisma/client/runtime/library").DefaultArgs> | import("@prisma/client/runtime/library").DynamicClientExtensionThis<import(".prisma/client").Prisma.TypeMap<import("@prisma/client/runtime/library").InternalArgs & {
    result: {};
    model: {};
    query: {};
    client: {};
}, {}>, import(".prisma/client").Prisma.TypeMapCb<{
    log: ("error" | "info" | "query" | "warn")[];
}>, {
    result: {};
    model: {};
    query: {};
    client: {};
}>;
declare let prisma: ReturnType<typeof createPrismaClient>;
declare global {
    var __prisma: ReturnType<typeof createPrismaClient> | undefined;
}
export declare const connectDatabase: () => Promise<void>;
export declare const disconnectDatabase: () => Promise<void>;
export { prisma };
//# sourceMappingURL=database.d.ts.map