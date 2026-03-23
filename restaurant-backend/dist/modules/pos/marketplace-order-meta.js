"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachMarketplaceMetadataToOrders = exports.attachMarketplaceOrderMetadata = exports.extractMarketplaceOrderMetadata = exports.MARKETPLACE_SOURCE_SYSTEMS = void 0;
exports.MARKETPLACE_SOURCE_SYSTEMS = ['ZOMATO', 'SWIGGY'];
const MARKETPLACE_ORDER_MARKER_REGEX = /\[(ZOMATO|SWIGGY)\]\s*External Order\s+([^|\]]+)/i;
const extractMarketplaceOrderMetadata = (specialInstructions) => {
    if (!specialInstructions)
        return null;
    const match = MARKETPLACE_ORDER_MARKER_REGEX.exec(specialInstructions);
    if (!match)
        return null;
    const sourceSystem = String(match[1] || '').toUpperCase();
    if (!exports.MARKETPLACE_SOURCE_SYSTEMS.includes(sourceSystem)) {
        return null;
    }
    const externalOrderId = String(match[2] || '').trim();
    return {
        sourceSystem,
        externalOrderId: externalOrderId || null,
    };
};
exports.extractMarketplaceOrderMetadata = extractMarketplaceOrderMetadata;
const attachMarketplaceOrderMetadata = (order) => {
    const metadata = (0, exports.extractMarketplaceOrderMetadata)(order.specialInstructions);
    if (!metadata) {
        return order;
    }
    return {
        ...order,
        sourceSystem: metadata.sourceSystem,
        externalOrderId: metadata.externalOrderId,
    };
};
exports.attachMarketplaceOrderMetadata = attachMarketplaceOrderMetadata;
const attachMarketplaceMetadataToOrders = (orders) => orders.map((order) => (0, exports.attachMarketplaceOrderMetadata)(order));
exports.attachMarketplaceMetadataToOrders = attachMarketplaceMetadataToOrders;
//# sourceMappingURL=marketplace-order-meta.js.map