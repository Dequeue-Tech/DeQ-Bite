import { Prisma, PrismaClient } from '@prisma/client';
export declare class InventoryError extends Error {
    statusCode: number;
    details?: unknown;
    constructor(message: string, statusCode?: number, details?: unknown);
}
type InventoryTx = Prisma.TransactionClient | PrismaClient;
type DeductionItem = {
    menuItemId: string;
    quantity: number;
};
type DeductionParams = {
    restaurantId: string;
    orderId: string;
    createdByUserId?: string | undefined;
    items: DeductionItem[];
};
export declare const deductInventoryForOrder: (tx: InventoryTx, params: DeductionParams) => Promise<{
    adjustedMaterials: number;
    lowStockAlerts: string[];
}>;
export declare const receivePurchaseOrder: (tx: InventoryTx, params: {
    restaurantId: string;
    purchaseOrderId: string;
    receivedByUserId?: string | undefined;
    items: Array<{
        rawMaterialId: string;
        quantityReceived: number;
        unitCostPaise?: number | undefined;
    }>;
}) => Promise<void>;
export {};
//# sourceMappingURL=inventory.service.d.ts.map