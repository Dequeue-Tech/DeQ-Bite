import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { deductInventoryForOrder, InventoryError } from '@/modules/inventory/inventory.service';
import { createKOTTicketForOrder } from '@/modules/kot/kot.service';
import { syncCustomerOrderProfile } from '@/modules/crm/crm.service';
import { emitRestaurantEvent } from '@/utils/realtime';

const TAX_RATE = 0.08;
const MAX_POS_LINE_ITEMS = 150;
const MAX_POS_ITEM_QUANTITY = 50;

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
  customerProfile: { id: string; loyaltyPoints: number } | null;
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

const normalizeCouponCode = (code: string) => code.trim().toUpperCase();
const normalizeExternalOrderId = (value?: string) => value?.trim() || null;

const normalizePosItems = (items: PosOrderItem[]) => {
  if (items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  if (items.length > MAX_POS_LINE_ITEMS) {
    throw new Error(`Order exceeds max line items (${MAX_POS_LINE_ITEMS})`);
  }

  return items.map((item) => {
    const menuItemId = item.menuItemId.trim();
    if (!menuItemId) {
      throw new Error('Each order item must include a menuItemId');
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(`Invalid quantity for item ${menuItemId}`);
    }

    if (item.quantity > MAX_POS_ITEM_QUANTITY) {
      throw new Error(`Quantity for item ${menuItemId} exceeds limit (${MAX_POS_ITEM_QUANTITY})`);
    }

    const notes = item.notes?.trim();
    return {
      menuItemId,
      quantity: item.quantity,
      notes: notes ? notes.slice(0, 200) : '',
    };
  });
};

const extractOrderIdFromPayload = (payload: Prisma.JsonValue | null): string | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const maybeOrderId = (payload as Record<string, unknown>)['orderId'];
  return typeof maybeOrderId === 'string' && maybeOrderId.length > 0 ? maybeOrderId : null;
};

const calculateDiscountFromCoupon = (coupon: {
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  minOrderPaise: number | null;
  type: 'PERCENT' | 'FIXED';
  value: number;
  maxDiscountPaise: number | null;
}, subtotalPaise: number) => {
  if (!coupon.active) return 0;

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return 0;
  if (coupon.endsAt && coupon.endsAt < now) return 0;
  if (coupon.minOrderPaise && subtotalPaise < coupon.minOrderPaise) return 0;

  let discountPaise = 0;
  if (coupon.type === 'PERCENT') {
    discountPaise = Math.floor((subtotalPaise * coupon.value) / 100);
  } else {
    discountPaise = coupon.value;
  }

  if (coupon.maxDiscountPaise && discountPaise > coupon.maxDiscountPaise) {
    discountPaise = coupon.maxDiscountPaise;
  }

  return Math.min(discountPaise, subtotalPaise);
};

const buildOrderEventPayload = (order: {
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
}) => ({
  order: {
    id: order.id,
    userId: order.userId,
    tableId: order.tableId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentProvider: order.paymentProvider,
    paidAmountPaise: order.paidAmountPaise,
    dueAmountPaise: order.dueAmountPaise,
    totalPaise: order.totalPaise,
    updatedAt: order.updatedAt,
    createdAt: order.createdAt,
    items: order.items,
    table: order.table,
    subtotalPaise: order.subtotalPaise,
    taxPaise: order.taxPaise,
    discountPaise: order.discountPaise,
  },
});

export const createIntegratedPosOrder = async (input: CreateIntegratedPosOrderInput) => {
  const selectedProvider = input.paymentProvider || 'RAZORPAY';
  const normalizedItems = normalizePosItems(input.items);
  const normalizedExternalOrderId = normalizeExternalOrderId(input.externalOrderId) || undefined;

  if (normalizedExternalOrderId) {
    const existingSuccessLog = await prisma.posSyncLog.findFirst({
      where: {
        restaurantId: input.restaurantId,
        sourceSystem: input.sourceSystem,
        eventType: 'ORDER_CREATED',
        externalOrderId: normalizedExternalOrderId,
        status: 'SUCCESS',
      },
      orderBy: { createdAt: 'desc' },
    });

    const existingOrderId = extractOrderIdFromPayload(existingSuccessLog?.payload ?? null);
    if (existingSuccessLog && existingOrderId) {
      const existingOrder = await prisma.order.findFirst({
        where: {
          id: existingOrderId,
          restaurantId: input.restaurantId,
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
        },
      });

      if (existingOrder) {
        const [existingTicket, existingProfile] = await Promise.all([
          prisma.kOTTicket.findFirst({
            where: { restaurantId: input.restaurantId, orderId: existingOrder.id },
          }),
          prisma.customerProfile.findUnique({
            where: {
              restaurantId_userId: {
                restaurantId: input.restaurantId,
                userId: existingOrder.userId,
              },
            },
            select: {
              id: true,
              loyaltyPoints: true,
            },
          }),
        ]);

        const replayResult: IntegratedPosOrderResult = {
          order: existingOrder,
          ticket: existingTicket,
          customerProfile: existingProfile,
          inventoryResult: {
            adjustedMaterials: 0,
            lowStockAlerts: [],
          },
          syncLog: {
            id: existingSuccessLog.id,
            status: existingSuccessLog.status,
            createdAt: existingSuccessLog.createdAt,
            updatedAt: existingSuccessLog.updatedAt,
          },
          idempotentReplay: true,
        };

        return replayResult;
      }
    }
  }

  try {
    const created: IntegratedPosOrderResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const table = await tx.table.findFirst({
        where: {
          id: input.tableId,
          restaurantId: input.restaurantId,
          active: true,
        },
      });

      if (!table) {
        throw new Error('Invalid table selected');
      }

      const customer = await tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });

      if (!customer) {
        throw new Error('Invalid customer selected');
      }

      const menuItems = await tx.menuItem.findMany({
        where: {
          id: { in: normalizedItems.map((item) => item.menuItemId) },
          restaurantId: input.restaurantId,
        },
        select: {
          id: true,
          name: true,
          pricePaise: true,
          available: true,
        },
      });

      const menuMap = new Map(menuItems.map((item) => [item.id, item]));
      let subtotalPaise = 0;
      const orderItems = [] as Array<{ menuItemId: string; quantity: number; pricePaise: number; notes: string }>;

      for (const item of normalizedItems) {
        const menu = menuMap.get(item.menuItemId);
        if (!menu || !menu.available) {
          throw new Error(`Menu item ${item.menuItemId} is not available`);
        }
        subtotalPaise += menu.pricePaise * item.quantity;
        orderItems.push({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          pricePaise: menu.pricePaise,
          notes: item.notes || '',
        });
      }

      let appliedCouponId: string | null = null;
      let normalizedCouponCode: string | null = null;
      let discountPaise = 0;

      if (input.couponCode) {
        normalizedCouponCode = normalizeCouponCode(input.couponCode);
        const coupon = await tx.coupon.findUnique({
          where: {
            restaurantId_code: {
              restaurantId: input.restaurantId,
              code: normalizedCouponCode,
            },
          },
        });

        if (!coupon || !coupon.active) {
          throw new Error('Invalid or inactive coupon code');
        }

        if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
          throw new Error('Coupon usage limit reached');
        }

        discountPaise = calculateDiscountFromCoupon(coupon, subtotalPaise);
        appliedCouponId = coupon.id;

        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      const taxablePaise = Math.max(subtotalPaise - discountPaise, 0);
      const taxPaise = Math.round(taxablePaise * TAX_RATE);
      const totalPaise = taxablePaise + taxPaise;

      const order = await tx.order.create({
        data: {
          userId: input.userId,
          tableId: input.tableId,
          restaurantId: input.restaurantId,
          subtotalPaise,
          taxPaise,
          discountPaise,
          totalPaise,
          paymentProvider: selectedProvider,
          paymentStatus: selectedProvider === 'CASH' ? 'PROCESSING' : 'PENDING',
          paidAmountPaise: 0,
          dueAmountPaise: totalPaise,
          paymentCollectionTiming: 'AFTER_MEAL',
          specialInstructions: input.specialInstructions || '',
          couponId: appliedCouponId,
          status: 'PENDING',
          items: {
            create: orderItems,
          },
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
        },
      });

      const inventoryResult = await deductInventoryForOrder(tx, {
        restaurantId: input.restaurantId,
        orderId: order.id,
        createdByUserId: input.createdByUserId,
        items: orderItems.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
      });

      const ticket = await createKOTTicketForOrder(tx, {
        restaurantId: input.restaurantId,
        orderId: order.id,
        createdByUserId: input.createdByUserId,
        note: 'KOT created from POS order',
      });

      const customerProfile = await syncCustomerOrderProfile(tx, {
        restaurantId: input.restaurantId,
        userId: input.userId,
        orderId: order.id,
        totalPaise,
        couponId: appliedCouponId,
        couponCode: normalizedCouponCode,
        discountPaise,
        createdByUserId: input.createdByUserId,
      });

      const syncLog = await tx.posSyncLog.create({
        data: {
          restaurantId: input.restaurantId,
          sourceSystem: input.sourceSystem,
          eventType: 'ORDER_CREATED',
          externalOrderId: normalizedExternalOrderId ?? null,
          payload: {
            orderId: order.id,
            itemCount: orderItems.length,
            totalPaise,
            replayableKey: normalizedExternalOrderId
              ? `${input.sourceSystem}:${normalizedExternalOrderId}`
              : null,
            provider: selectedProvider,
          },
          status: 'SUCCESS',
        },
      });

      return {
        order,
        ticket,
        customerProfile,
        inventoryResult,
        syncLog,
      };
    });

    if (created.idempotentReplay) {
      return created;
    }

    emitRestaurantEvent(input.restaurantId, {
      type: 'order.created',
      userId: created.order.userId,
      payload: buildOrderEventPayload(created.order),
    });

    emitRestaurantEvent(input.restaurantId, {
      type: 'kot.created',
      payload: {
        ticket: created.ticket,
      },
    });

    emitRestaurantEvent(input.restaurantId, {
      type: 'inventory.updated',
      payload: {
        orderId: created.order.id,
        adjustedMaterials: created.inventoryResult.adjustedMaterials,
        lowStockAlerts: created.inventoryResult.lowStockAlerts,
      },
    });

    if (created.customerProfile) {
      emitRestaurantEvent(input.restaurantId, {
        type: 'crm.updated',
        payload: {
          orderId: created.order.id,
          customerProfileId: created.customerProfile.id,
          loyaltyPoints: created.customerProfile.loyaltyPoints,
        },
      });
    }

    return created;
  } catch (error: unknown) {
    await prisma.posSyncLog.create({
      data: {
        restaurantId: input.restaurantId,
        sourceSystem: input.sourceSystem,
        eventType: 'ORDER_CREATED',
        externalOrderId: normalizedExternalOrderId ?? null,
        payload: {
          userId: input.userId,
          tableId: input.tableId,
          itemCount: normalizedItems.length,
        },
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown POS integration error',
      },
    });

    if (error instanceof InventoryError) {
      throw error;
    }

    throw error;
  }
};
