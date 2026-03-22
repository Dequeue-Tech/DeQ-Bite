import { KOTStatus, Prisma, PrismaClient } from '@prisma/client';
export declare class KOTError extends Error {
    statusCode: number;
    constructor(message: string, statusCode?: number);
}
type Tx = Prisma.TransactionClient | PrismaClient;
export declare const createKOTTicketForOrder: (tx: Tx, params: {
    restaurantId: string;
    orderId: string;
    priority?: number;
    note?: string | undefined;
    createdByUserId?: string | undefined;
}) => Promise<{
    restaurantId: string;
    id: string;
    status: import(".prisma/client").$Enums.KOTStatus;
    notes: string | null;
    orderId: string;
    priority: number;
    placedAt: Date;
    preparingAt: Date | null;
    readyAt: Date | null;
    servedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    createdByUserId: string | null;
}>;
export declare const updateKOTStatus: (params: {
    restaurantId: string;
    orderId: string;
    status: KOTStatus;
    changedByUserId?: string | undefined;
    note?: string | undefined;
}) => Promise<any>;
export declare const updateKOTPriority: (params: {
    restaurantId: string;
    orderId: string;
    priority: number;
    changedByUserId?: string | undefined;
    note?: string | undefined;
}) => Promise<any>;
export declare const getKOTOperationalSummary: (params: {
    restaurantId: string;
    now?: Date;
    overdueThresholdMinutes?: number;
}) => Promise<{
    generatedAt: Date;
    thresholdMinutes: number;
    queue: {
        totalActive: any;
        byStatus: Record<import(".prisma/client").$Enums.KOTStatus, number>;
        overdueCount: any;
        avgTicketAgeMinutes: number;
        throughputLastHour: any;
        avgPrepMinutesToday: number;
        avgFulfillmentMinutesToday: number;
    };
    topAgingTickets: any;
}>;
export {};
//# sourceMappingURL=kot.service.d.ts.map