"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIntegratedPosOrder = void 0;
const database_1 = require("../../config/database");
const inventory_service_1 = require("../../modules/inventory/inventory.service");
const kot_service_1 = require("../../modules/kot/kot.service");
const crm_service_1 = require("../../modules/crm/crm.service");
const realtime_1 = require("../../utils/realtime");
const TAX_RATE = 0.08;
const MAX_POS_LINE_ITEMS = 150;
const MAX_POS_ITEM_QUANTITY = 50;
const normalizeCouponCode = (code) => code.trim().toUpperCase();
const normalizeExternalOrderId = (value) => value?.trim() || null;
const normalizePosItems = (items) => {
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
const extractOrderIdFromPayload = (payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }
    const maybeOrderId = payload['orderId'];
    return typeof maybeOrderId === 'string' && maybeOrderId.length > 0 ? maybeOrderId : null;
};
const calculateDiscountFromCoupon = (coupon, subtotalPaise) => {
    if (!coupon.active)
        return 0;
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now)
        return 0;
    if (coupon.endsAt && coupon.endsAt < now)
        return 0;
    if (coupon.minOrderPaise && subtotalPaise < coupon.minOrderPaise)
        return 0;
    let discountPaise = 0;
    if (coupon.type === 'PERCENT') {
        discountPaise = Math.floor((subtotalPaise * coupon.value) / 100);
    }
    else {
        discountPaise = coupon.value;
    }
    if (coupon.maxDiscountPaise && discountPaise > coupon.maxDiscountPaise) {
        discountPaise = coupon.maxDiscountPaise;
    }
    return Math.min(discountPaise, subtotalPaise);
};
const buildOrderEventPayload = (order) => ({
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
const createIntegratedPosOrder = async (input) => {
    const selectedProvider = input.paymentProvider || 'RAZORPAY';
    const normalizedItems = normalizePosItems(input.items);
    const normalizedExternalOrderId = normalizeExternalOrderId(input.externalOrderId) || undefined;
    if (normalizedExternalOrderId) {
        const existingSuccessLog = await database_1.prisma.posSyncLog.findFirst({
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
            const existingOrder = await database_1.prisma.order.findFirst({
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
                    database_1.prisma.kOTTicket.findFirst({
                        where: { restaurantId: input.restaurantId, orderId: existingOrder.id },
                    }),
                    database_1.prisma.customerProfile.findUnique({
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
                const replayResult = {
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
        const created = await database_1.prisma.$transaction(async (tx) => {
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
            const orderItems = [];
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
            let appliedCouponId = null;
            let normalizedCouponCode = null;
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
            const inventoryResult = await (0, inventory_service_1.deductInventoryForOrder)(tx, {
                restaurantId: input.restaurantId,
                orderId: order.id,
                createdByUserId: input.createdByUserId,
                items: orderItems.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
            });
            const ticket = await (0, kot_service_1.createKOTTicketForOrder)(tx, {
                restaurantId: input.restaurantId,
                orderId: order.id,
                createdByUserId: input.createdByUserId,
                note: 'KOT created from POS order',
            });
            const customerProfile = await (0, crm_service_1.syncCustomerOrderProfile)(tx, {
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
        (0, realtime_1.emitRestaurantEvent)(input.restaurantId, {
            type: 'order.created',
            userId: created.order.userId,
            payload: buildOrderEventPayload(created.order),
        });
        (0, realtime_1.emitRestaurantEvent)(input.restaurantId, {
            type: 'kot.created',
            payload: {
                ticket: created.ticket,
            },
        });
        (0, realtime_1.emitRestaurantEvent)(input.restaurantId, {
            type: 'inventory.updated',
            payload: {
                orderId: created.order.id,
                adjustedMaterials: created.inventoryResult.adjustedMaterials,
                lowStockAlerts: created.inventoryResult.lowStockAlerts,
            },
        });
        if (created.customerProfile) {
            (0, realtime_1.emitRestaurantEvent)(input.restaurantId, {
                type: 'crm.updated',
                payload: {
                    orderId: created.order.id,
                    customerProfileId: created.customerProfile.id,
                    loyaltyPoints: created.customerProfile.loyaltyPoints,
                },
            });
        }
        return created;
    }
    catch (error) {
        await database_1.prisma.posSyncLog.create({
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
        if (error instanceof inventory_service_1.InventoryError) {
            throw error;
        }
        throw error;
    }
};
exports.createIntegratedPosOrder = createIntegratedPosOrder;
//# sourceMappingURL=pos.service.js.map