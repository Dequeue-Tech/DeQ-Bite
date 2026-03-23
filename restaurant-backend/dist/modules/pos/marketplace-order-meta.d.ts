export declare const MARKETPLACE_SOURCE_SYSTEMS: readonly ["ZOMATO", "SWIGGY"];
export type MarketplaceSourceSystem = (typeof MARKETPLACE_SOURCE_SYSTEMS)[number];
export type MarketplaceOrderMetadata = {
    sourceSystem: MarketplaceSourceSystem;
    externalOrderId: string | null;
};
type MarketplaceOrderLike = {
    specialInstructions?: string | null;
};
type MarketplaceAnnotatedOrder = {
    sourceSystem?: MarketplaceSourceSystem;
    externalOrderId?: string | null;
};
export declare const extractMarketplaceOrderMetadata: (specialInstructions?: string | null) => MarketplaceOrderMetadata | null;
export declare const attachMarketplaceOrderMetadata: <T extends MarketplaceOrderLike>(order: T) => T & MarketplaceAnnotatedOrder;
export declare const attachMarketplaceMetadataToOrders: <T extends MarketplaceOrderLike>(orders: T[]) => Array<T & MarketplaceAnnotatedOrder>;
export {};
//# sourceMappingURL=marketplace-order-meta.d.ts.map