export const MARKETPLACE_SOURCE_SYSTEMS = ['ZOMATO', 'SWIGGY'] as const;

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

const MARKETPLACE_ORDER_MARKER_REGEX = /\[(ZOMATO|SWIGGY)\]\s*External Order\s+([^|\]]+)/i;

export const extractMarketplaceOrderMetadata = (
  specialInstructions?: string | null
): MarketplaceOrderMetadata | null => {
  if (!specialInstructions) return null;

  const match = MARKETPLACE_ORDER_MARKER_REGEX.exec(specialInstructions);
  if (!match) return null;

  const sourceSystem = String(match[1] || '').toUpperCase() as MarketplaceSourceSystem;
  if (!MARKETPLACE_SOURCE_SYSTEMS.includes(sourceSystem)) {
    return null;
  }

  const externalOrderId = String(match[2] || '').trim();

  return {
    sourceSystem,
    externalOrderId: externalOrderId || null,
  };
};

export const attachMarketplaceOrderMetadata = <T extends MarketplaceOrderLike>(
  order: T
): T & MarketplaceAnnotatedOrder => {
  const metadata = extractMarketplaceOrderMetadata(order.specialInstructions);
  if (!metadata) {
    return order as T & MarketplaceAnnotatedOrder;
  }

  return {
    ...order,
    sourceSystem: metadata.sourceSystem,
    externalOrderId: metadata.externalOrderId,
  };
};

export const attachMarketplaceMetadataToOrders = <T extends MarketplaceOrderLike>(
  orders: T[]
): Array<T & MarketplaceAnnotatedOrder> => orders.map((order) => attachMarketplaceOrderMetadata(order));

