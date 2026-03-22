type PosOrderItem = {
    menuItemId: string;
    quantity: number;
    notes?: string | undefined;
};
type CreateIntegratedPosOrderInput = {
    restaurantId: string;
    userId: string;
    tableId: string;
    sourceSystem: string;
    externalOrderId?: string | undefined;
    items: PosOrderItem[];
    specialInstructions?: string | undefined;
    couponCode?: string | undefined;
    paymentProvider?: 'RAZORPAY' | 'PAYTM' | 'PHONEPE' | 'CASH' | undefined;
    createdByUserId?: string | undefined;
};
type IntegratedPosOrderResult = {
    order: {
        id: string;
        userId: string;
        tableId: string;
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
export declare const createIntegratedPosOrder: (input: CreateIntegratedPosOrderInput) => Promise<IntegratedPosOrderResult>;
export {};
//# sourceMappingURL=pos.service.d.ts.map