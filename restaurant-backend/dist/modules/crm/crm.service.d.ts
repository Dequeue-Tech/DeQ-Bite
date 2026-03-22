import { Prisma, PrismaClient } from '@prisma/client';
type Tx = Prisma.TransactionClient | PrismaClient;
type ProfileShape = {
    totalOrders: number;
    totalSpendPaise: number;
    loyaltyPoints: number;
    lastOrderAt?: Date | null;
    createdAt?: Date;
};
export type CrmSegment = 'NEW' | 'LOYAL' | 'HIGH_VALUE' | 'AT_RISK' | 'REGULAR';
export declare const classifyCrmSegment: (profile: ProfileShape, now?: Date) => CrmSegment;
export declare const computeCrmHealth: (profile: ProfileShape, now?: Date) => {
    score: number;
    risk: string;
    inactiveDays: number | null;
};
export declare const buildCrmSegmentsSummary: (profiles: ProfileShape[], now?: Date) => {
    totalCustomers: number;
    segments: {
        segment: string;
        count: number;
        sharePct: number;
    }[];
};
export declare const syncCustomerOrderProfile: (tx: Tx, params: {
    restaurantId: string;
    userId: string;
    orderId: string;
    totalPaise: number;
    couponId?: string | null;
    couponCode?: string | null;
    discountPaise?: number;
    createdByUserId?: string | undefined;
}) => Promise<{
    restaurantId: string;
    id: string;
    notes: string | null;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    loyaltyPoints: number;
    totalOrders: number;
    totalSpendPaise: number;
    lastOrderAt: Date | null;
    tier: string;
}>;
export declare const redeemLoyaltyPoints: (tx: Tx, params: {
    restaurantId: string;
    userId: string;
    points: number;
    reason?: string | undefined;
    createdByUserId?: string | undefined;
}) => Promise<{
    restaurantId: string;
    id: string;
    notes: string | null;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    loyaltyPoints: number;
    totalOrders: number;
    totalSpendPaise: number;
    lastOrderAt: Date | null;
    tier: string;
}>;
export {};
//# sourceMappingURL=crm.service.d.ts.map