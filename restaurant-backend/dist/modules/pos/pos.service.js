"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketplaceIntegratedOrders = exports.createMarketplaceIntegratedOrder = exports.createIntegratedPosOrder = void 0;
const crypto_1 = require("crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../../config/database");
const inventory_service_1 = require("../../modules/inventory/inventory.service");
const kot_service_1 = require("../../modules/kot/kot.service");
const crm_service_1 = require("../../modules/crm/crm.service");
const realtime_1 = require("../../utils/realtime");
const marketplace_order_meta_1 = require("../../modules/pos/marketplace-order-meta");
const TAX_RATE = 0.08;
const MAX_POS_LINE_ITEMS = 150;
const MAX_POS_ITEM_QUANTITY = 50;
const MAX_MARKETPLACE_ITEMS = 80;
const MARKETPLACE_SOURCE_SYSTEMS = ['ZOMATO', 'SWIGGY'];
const normalizeCouponCode = (code) => code.trim().toUpperCase();
const normalizeExternalOrderId = (value) => value?.trim() || null;
const normalizePhoneNumber = (value) => {
    if (!value)
        return null;
    const normalized = value.trim();
    if (!normalized)
        return null;
    const sanitized = normalized.replace(/\s+/g, '');
    return sanitized.length > 20 ? sanitized.slice(0, 20) : sanitized;
};
const sanitizeFreeText = (value, maxLen) => {
    const trimmed = value?.trim();
    if (!trimmed)
        return '';
    return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
};
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
        return {
            menuItemId,
            quantity: item.quantity,
            notes: sanitizeFreeText(item.notes, 200),
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
        ...(() => {
            const metadata = (0, marketplace_order_meta_1.extractMarketplaceOrderMetadata)(order.specialInstructions);
            if (!metadata)
                return {};
            return {
                sourceSystem: metadata.sourceSystem,
                externalOrderId: metadata.externalOrderId,
            };
        })(),
    },
});
const findExistingOrderReplay = async (input) => {
    if (!input.externalOrderId)
        return null;
    const existingSuccessLog = await database_1.prisma.posSyncLog.findFirst({
        where: {
            restaurantId: input.restaurantId,
            sourceSystem: input.sourceSystem,
            eventType: 'ORDER_CREATED',
            externalOrderId: input.externalOrderId,
            status: 'SUCCESS',
        },
        orderBy: { createdAt: 'desc' },
    });
    const existingOrderId = extractOrderIdFromPayload(existingSuccessLog?.payload ?? null);
    if (!existingSuccessLog || !existingOrderId) {
        return null;
    }
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
    if (!existingOrder) {
        return null;
    }
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
    return {
        order: (0, marketplace_order_meta_1.attachMarketplaceOrderMetadata)(existingOrder),
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
};
const ensureDeliveryTable = async (tx, restaurantId) => {
    const existing = await tx.table.findFirst({
        where: {
            restaurantId,
            active: true,
            location: { equals: 'DELIVERY', mode: 'insensitive' },
        },
    });
    if (existing)
        return existing;
    const maxNumberRow = await tx.table.findFirst({
        where: { restaurantId },
        orderBy: { number: 'desc' },
        select: { number: true },
    });
    return tx.table.create({
        data: {
            restaurantId,
            number: (maxNumberRow?.number || 0) + 1,
            capacity: 1,
            location: 'DELIVERY',
            active: true,
        },
    });
};
const buildSyntheticGuestEmail = (input) => {
    const sanitizedExternalId = input.externalOrderId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const compactExternalId = sanitizedExternalId.slice(0, 18) || (0, crypto_1.randomUUID)().replace(/-/g, '').slice(0, 18);
    const compactRestaurantId = input.restaurantId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(-8) || 'rest';
    return `guest+${input.sourceSystem.toLowerCase()}-${compactRestaurantId}-${compactExternalId}@deq-guest.local`;
};
const resolveMarketplaceCustomer = async (tx, input) => {
    const normalizedPhone = normalizePhoneNumber(input.customer.phone);
    const normalizedEmail = sanitizeFreeText(input.customer.email, 120).toLowerCase();
    if (normalizedPhone) {
        const byPhone = await tx.user.findUnique({
            where: { phone: normalizedPhone },
            select: { id: true },
        });
        if (byPhone) {
            return byPhone.id;
        }
    }
    if (normalizedEmail) {
        const byEmail = await tx.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true },
        });
        if (byEmail) {
            return byEmail.id;
        }
    }
    const syntheticEmail = normalizedEmail ||
        buildSyntheticGuestEmail({
            restaurantId: input.restaurantId,
            sourceSystem: input.sourceSystem,
            externalOrderId: input.externalOrderId,
        });
    const existingSynthetic = await tx.user.findUnique({
        where: { email: syntheticEmail },
        select: { id: true },
    });
    if (existingSynthetic) {
        return existingSynthetic.id;
    }
    const hashedPassword = await bcryptjs_1.default.hash((0, crypto_1.randomUUID)(), 10);
    const fallbackName = `${input.sourceSystem} Guest`;
    const safeName = sanitizeFreeText(input.customer.name, 80) || fallbackName;
    const created = await tx.user.create({
        data: {
            name: safeName,
            email: syntheticEmail,
            password: hashedPassword,
            role: 'CUSTOMER',
            ...(normalizedPhone ? { phone: normalizedPhone } : {}),
        },
        select: { id: true },
    });
    return created.id;
};
const resolveMarketplaceItems = async (tx, input) => {
    if (input.items.length === 0) {
        throw new Error('At least one order item is required');
    }
    if (input.items.length > MAX_MARKETPLACE_ITEMS) {
        throw new Error(`Order exceeds max line items (${MAX_MARKETPLACE_ITEMS})`);
    }
    const normalizedItems = input.items.map((item) => {
        const menuItemId = sanitizeFreeText(item.menuItemId, 120);
        const menuItemName = sanitizeFreeText(item.menuItemName, 120);
        if (!menuItemId && !menuItemName) {
            throw new Error('Each item must include either menuItemId or menuItemName');
        }
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
            throw new Error('Item quantity must be a positive integer');
        }
        if (item.quantity > MAX_POS_ITEM_QUANTITY) {
            throw new Error(`Item quantity cannot exceed ${MAX_POS_ITEM_QUANTITY}`);
        }
        return {
            menuItemId,
            menuItemName,
            quantity: item.quantity,
            notes: sanitizeFreeText(item.notes, 200),
        };
    });
    const itemIds = Array.from(new Set(normalizedItems
        .map((item) => item.menuItemId)
        .filter((value) => Boolean(value))));
    const itemNames = Array.from(new Set(normalizedItems
        .map((item) => item.menuItemName)
        .filter((value) => Boolean(value))
        .map((value) => value.toLowerCase())));
    const [itemsById, itemsByName] = await Promise.all([
        itemIds.length
            ? tx.menuItem.findMany({
                where: {
                    restaurantId: input.restaurantId,
                    id: { in: itemIds },
                },
                select: {
                    id: true,
                    available: true,
                },
            })
            : Promise.resolve([]),
        itemNames.length
            ? tx.menuItem.findMany({
                where: {
                    restaurantId: input.restaurantId,
                    OR: itemNames.map((name) => ({
                        name: { equals: name, mode: 'insensitive' },
                    })),
                },
                select: {
                    id: true,
                    name: true,
                    available: true,
                },
            })
            : Promise.resolve([]),
    ]);
    const idMap = new Map(itemsById.map((item) => [item.id, item]));
    const nameMap = new Map(itemsByName.map((item) => [item.name.toLowerCase(), item]));
    return normalizedItems.map((item) => {
        if (item.menuItemId) {
            const matched = idMap.get(item.menuItemId);
            if (!matched || !matched.available) {
                throw new Error(`Menu item ${item.menuItemId} is not available`);
            }
            return {
                menuItemId: matched.id,
                quantity: item.quantity,
                notes: item.notes,
            };
        }
        const lookup = item.menuItemName ? nameMap.get(item.menuItemName.toLowerCase()) : null;
        if (!lookup || !lookup.available) {
            throw new Error(`Menu item \"${item.menuItemName || ''}\" is not available`);
        }
        return {
            menuItemId: lookup.id,
            quantity: item.quantity,
            notes: item.notes,
        };
    });
};
const mapPaymentState = (input) => {
    let paidAmount = typeof input.paidAmountPaise === 'number'
        ? Math.max(0, Math.floor(input.paidAmountPaise))
        : 0;
    let paymentStatus = input.requestedStatus || 'PENDING';
    if (paymentStatus === 'COMPLETED' && typeof input.paidAmountPaise !== 'number') {
        paidAmount = input.totalPaise;
    }
    if (paidAmount > input.totalPaise) {
        paidAmount = input.totalPaise;
    }
    const dueAmount = Math.max(input.totalPaise - paidAmount, 0);
    if (dueAmount === 0 && paymentStatus !== 'REFUNDED' && paymentStatus !== 'FAILED') {
        paymentStatus = 'COMPLETED';
    }
    else if (dueAmount > 0 &&
        paidAmount > 0 &&
        paymentStatus !== 'FAILED' &&
        paymentStatus !== 'REFUNDED') {
        paymentStatus = 'PARTIALLY_PAID';
    }
    return {
        paidAmountPaise: paidAmount,
        dueAmountPaise: dueAmount,
        paymentStatus,
    };
};
const buildMarketplaceInstructions = (input) => {
    const blocks = [
        sanitizeFreeText(input.specialInstructions, 400),
        `[${input.sourceSystem}] External Order ${input.externalOrderId}`,
        `Customer: ${sanitizeFreeText(input.customer.name, 80) || 'Guest'}`,
        `Address: ${sanitizeFreeText(input.customer.address, 240)}`,
        input.customer.phone ? `Phone: ${sanitizeFreeText(input.customer.phone, 30)}` : '',
    ].filter((entry) => entry.length > 0);
    return blocks.join(' | ');
};
const createIntegratedPosOrder = async (input) => {
    const selectedProvider = input.paymentProvider || 'RAZORPAY';
    const normalizedItems = normalizePosItems(input.items);
    const normalizedExternalOrderId = normalizeExternalOrderId(input.externalOrderId) || undefined;
    const replayLookup = {
        restaurantId: input.restaurantId,
        sourceSystem: input.sourceSystem,
        ...(normalizedExternalOrderId ? { externalOrderId: normalizedExternalOrderId } : {}),
    };
    const replay = await findExistingOrderReplay(replayLookup);
    if (replay) {
        return replay;
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
                order: (0, marketplace_order_meta_1.attachMarketplaceOrderMetadata)(order),
                ticket,
                customerProfile,
                inventoryResult,
                syncLog,
            };
        });
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
const createMarketplaceIntegratedOrder = async (input) => {
    const normalizedExternalOrderId = normalizeExternalOrderId(input.externalOrderId);
    if (!normalizedExternalOrderId) {
        throw new Error('externalOrderId is required');
    }
    const replay = await findExistingOrderReplay({
        restaurantId: input.restaurantId,
        sourceSystem: input.sourceSystem,
        externalOrderId: normalizedExternalOrderId,
    });
    if (replay) {
        return replay;
    }
    const prepared = await database_1.prisma.$transaction(async (tx) => {
        const [deliveryTable, resolvedItems] = await Promise.all([
            ensureDeliveryTable(tx, input.restaurantId),
            resolveMarketplaceItems(tx, {
                restaurantId: input.restaurantId,
                items: input.items,
            }),
        ]);
        const customerUserId = await resolveMarketplaceCustomer(tx, {
            restaurantId: input.restaurantId,
            sourceSystem: input.sourceSystem,
            externalOrderId: normalizedExternalOrderId,
            customer: input.customer,
        });
        return {
            customerUserId,
            tableId: deliveryTable.id,
            items: resolvedItems,
        };
    });
    const integrationInstructions = buildMarketplaceInstructions({
        sourceSystem: input.sourceSystem,
        externalOrderId: normalizedExternalOrderId,
        customer: {
            name: input.customer.name,
            address: input.customer.address,
            ...(input.customer.phone ? { phone: input.customer.phone } : {}),
        },
        ...(input.specialInstructions ? { specialInstructions: input.specialInstructions } : {}),
    });
    const createPayload = {
        restaurantId: input.restaurantId,
        userId: prepared.customerUserId,
        tableId: prepared.tableId,
        sourceSystem: input.sourceSystem,
        externalOrderId: normalizedExternalOrderId,
        items: prepared.items,
        specialInstructions: integrationInstructions,
        ...(input.paymentProvider ? { paymentProvider: input.paymentProvider } : {}),
        ...(input.createdByUserId ? { createdByUserId: input.createdByUserId } : {}),
    };
    const created = await (0, exports.createIntegratedPosOrder)(createPayload);
    if (created.idempotentReplay) {
        return created;
    }
    const paymentProjection = mapPaymentState({
        totalPaise: created.order.totalPaise,
        ...(input.paymentStatus ? { requestedStatus: input.paymentStatus } : {}),
        ...(typeof input.paidAmountPaise === 'number' ? { paidAmountPaise: input.paidAmountPaise } : {}),
    });
    const updatedOrder = await database_1.prisma.order.update({
        where: { id: created.order.id },
        data: {
            isDelivery: true,
            deliveryStatus: 'PLACED',
            deliveryCustomerName: sanitizeFreeText(input.customer.name, 80) || 'Guest',
            deliveryCustomerPhone: normalizePhoneNumber(input.customer.phone),
            deliveryAddress: sanitizeFreeText(input.customer.address, 240),
            deliveryLandmark: sanitizeFreeText(input.customer.landmark, 120) || null,
            paidAmountPaise: paymentProjection.paidAmountPaise,
            dueAmountPaise: paymentProjection.dueAmountPaise,
            paymentStatus: paymentProjection.paymentStatus,
        },
        include: {
            items: { include: { menuItem: true } },
            table: true,
        },
    });
    (0, realtime_1.emitRestaurantEvent)(input.restaurantId, {
        type: 'order.updated',
        userId: updatedOrder.userId,
        payload: buildOrderEventPayload(updatedOrder),
    });
    return {
        ...created,
        order: (0, marketplace_order_meta_1.attachMarketplaceOrderMetadata)(updatedOrder),
    };
};
exports.createMarketplaceIntegratedOrder = createMarketplaceIntegratedOrder;
const getMarketplaceIntegratedOrders = async (input) => {
    const take = Math.min(Math.max(input.limit || 20, 1), 100);
    const sourceFilter = input.sourceSystem;
    const logs = await database_1.prisma.posSyncLog.findMany({
        where: {
            restaurantId: input.restaurantId,
            eventType: 'ORDER_CREATED',
            status: 'SUCCESS',
            ...(sourceFilter
                ? { sourceSystem: sourceFilter }
                : {
                    sourceSystem: {
                        in: [...MARKETPLACE_SOURCE_SYSTEMS],
                    },
                }),
        },
        orderBy: { createdAt: 'desc' },
        take: Math.max(take * 2, 20),
    });
    const orderIds = Array.from(new Set(logs
        .map((log) => extractOrderIdFromPayload(log.payload))
        .filter((value) => Boolean(value))));
    if (orderIds.length === 0) {
        return [];
    }
    const orders = await database_1.prisma.order.findMany({
        where: {
            id: { in: orderIds },
            restaurantId: input.restaurantId,
        },
        include: {
            items: true,
            table: { select: { number: true } },
        },
    });
    const orderMap = new Map(orders.map((order) => [order.id, order]));
    const summaries = [];
    const seenOrderIds = new Set();
    for (const log of logs) {
        const orderId = extractOrderIdFromPayload(log.payload);
        if (!orderId || seenOrderIds.has(orderId))
            continue;
        const order = orderMap.get(orderId);
        if (!order)
            continue;
        if (!MARKETPLACE_SOURCE_SYSTEMS.includes(log.sourceSystem)) {
            continue;
        }
        summaries.push({
            orderId,
            sourceSystem: log.sourceSystem,
            externalOrderId: log.externalOrderId,
            syncLogId: log.id,
            syncedAt: log.createdAt,
            status: order.status,
            paymentStatus: order.paymentStatus,
            totalPaise: order.totalPaise,
            createdAt: order.createdAt,
            customerName: order.deliveryCustomerName,
            customerPhone: order.deliveryCustomerPhone,
            deliveryAddress: order.deliveryAddress,
            tableNumber: order.table?.number || null,
            itemsCount: order.items.length,
        });
        seenOrderIds.add(orderId);
        if (summaries.length >= take) {
            break;
        }
    }
    return summaries;
};
exports.getMarketplaceIntegratedOrders = getMarketplaceIntegratedOrders;
//# sourceMappingURL=pos.service.js.map