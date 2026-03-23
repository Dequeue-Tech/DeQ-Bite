declare const MARKETPLACE_SOURCE_SYSTEMS: readonly ["ZOMATO", "SWIGGY"];
export type PaymentProvider = 'RAZORPAY' | 'PAYTM' | 'PHONEPE' | 'CASH';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_PAID';
export type MarketplaceSourceSystem = (typeof MARKETPLACE_SOURCE_SYSTEMS)[number];
type PosOrderItem = {
    menuItemId: string;
    quantity: number;
    notes?: string;
};
type CreateIntegratedPosOrderInput = {
    restaurantId: string;
    userId: string;
    tableId: string;
    sourceSystem: string;
    externalOrderId?: string;
    items: PosOrderItem[];
    specialInstructions?: string;
    couponCode?: string;
    paymentProvider?: PaymentProvider;
    createdByUserId?: string;
};
export type CreateMarketplacePosOrderInput = {
    restaurantId: string;
    sourceSystem: MarketplaceSourceSystem;
    externalOrderId: string;
    customer: {
        name: string;
        phone?: string;
        email?: string;
        address: string;
        landmark?: string;
    };
    items: Array<{
        menuItemId?: string;
        menuItemName?: string;
        quantity: number;
        notes?: string;
    }>;
    specialInstructions?: string;
    paymentProvider?: PaymentProvider;
    paymentStatus?: PaymentStatus;
    paidAmountPaise?: number;
    createdByUserId?: string;
};
type IntegratedPosOrder = {
    id: string;
    userId: string;
    tableId: string;
    specialInstructions?: string | null;
    status: string;
    paymentStatus: string;
    paymentProvider: string;
    paidAmountPaise: number;
    dueAmountPaise: number;
    totalPaise: number;
    updatedAt: Date;
    createdAt: Date;
    items: unknown;
    table: unknown;
    subtotalPaise: number;
    taxPaise: number;
    discountPaise: number;
};
type IntegratedPosOrderResult = {
    order: IntegratedPosOrder;
    ticket: unknown;
    customerProfile: {
        id: string;
        loyaltyPoints: number;
    } | null;
    inventoryResult: {
        adjustedMaterials: number;
        lowStockAlerts: string[];
    };
    syncLog: {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    };
    idempotentReplay?: boolean;
};
export type MarketplaceOrderSummary = {
    orderId: string;
    sourceSystem: MarketplaceSourceSystem;
    externalOrderId: string | null;
    syncLogId: string;
    syncedAt: Date;
    status: string;
    paymentStatus: string;
    totalPaise: number;
    createdAt: Date;
    customerName: string | null;
    customerPhone: string | null;
    deliveryAddress: string | null;
    tableNumber: number | null;
    itemsCount: number;
};
export declare const createIntegratedPosOrder: (input: CreateIntegratedPosOrderInput) => Promise<IntegratedPosOrderResult>;
export declare const createMarketplaceIntegratedOrder: (input: CreateMarketplacePosOrderInput) => Promise<{
    order: any;
    ticket: unknown;
    customerProfile: {
        id: string;
        loyaltyPoints: number;
    } | null;
    inventoryResult: {
        adjustedMaterials: number;
        lowStockAlerts: string[];
    };
    syncLog: {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    };
    idempotentReplay?: boolean;
}>;
export declare const getMarketplaceIntegratedOrders: (input: {
    restaurantId: string;
    sourceSystem?: MarketplaceSourceSystem;
    limit?: number;
}) => Promise<MarketplaceOrderSummary[]>;
export {};
//# sourceMappingURL=pos.service.d.ts.map