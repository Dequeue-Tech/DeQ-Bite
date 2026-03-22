import { AnalyticsPeriodType } from '@prisma/client';
export declare const generateAnalyticsSnapshot: (params: {
    restaurantId: string;
    periodType: AnalyticsPeriodType;
    date?: Date;
}) => Promise<any>;
export declare const getAnalyticsOverview: (params: {
    restaurantId: string;
    start: Date;
    end: Date;
}) => Promise<{
    period: {
        start: Date;
        end: Date;
        previousStart: Date;
        previousEnd: Date;
        days: number;
    };
    summary: {
        revenuePaise: number;
        completedOrders: number;
        totalOrders: number;
        cancelledOrders: number;
        avgOrderValuePaise: number;
        uniqueCustomers: number;
        repeatCustomers: number;
        cancellationRatePct: number;
        paymentCompletionRatePct: number;
        repeatCustomerRatePct: number;
        topItems: {
            menuItemId: string;
            name: string;
            quantity: number;
            revenuePaise: number;
        }[];
        peakHours: {
            hour: number;
            orders: number;
        }[];
    };
    deltas: {
        revenuePct: number;
        completedOrdersPct: number;
        avgOrderValuePct: number;
        uniqueCustomersPct: number;
        repeatCustomerRatePct: number;
    };
    previous: {
        revenuePaise: number;
        completedOrders: number;
        totalOrders: number;
        cancelledOrders: number;
        avgOrderValuePaise: number;
        uniqueCustomers: number;
        repeatCustomers: number;
        cancellationRatePct: number;
        paymentCompletionRatePct: number;
        repeatCustomerRatePct: number;
        topItems: {
            menuItemId: string;
            name: string;
            quantity: number;
            revenuePaise: number;
        }[];
        peakHours: {
            hour: number;
            orders: number;
        }[];
    };
}>;
//# sourceMappingURL=analytics.service.d.ts.map