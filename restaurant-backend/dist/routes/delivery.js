"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("@/config/database");
const auth_1 = require("@/middleware/auth");
const restaurant_1 = require("@/middleware/restaurant");
const realtime_1 = require("@/utils/realtime");
const sms_1 = require("@/lib/sms");
const router = (0, express_1.Router)();
const TAX_RATE = 0.08;
const DELIVERY_META_PREFIX = '[DELIVERY_META]';
router.use(auth_1.authenticate);
router.use(restaurant_1.requireRestaurant);
const toInr = (paise) => (paise / 100).toFixed(2);
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
        ...(order.items ? { items: order.items } : {}),
        ...(order.table ? { table: order.table } : {}),
        ...(order.user ? { user: order.user } : {}),
        ...(typeof order.subtotalPaise === 'number' ? { subtotalPaise: order.subtotalPaise } : {}),
        ...(typeof order.taxPaise === 'number' ? { taxPaise: order.taxPaise } : {}),
        ...(typeof order.discountPaise === 'number' ? { discountPaise: order.discountPaise } : {}),
    },
});
const parseDeliveryMeta = (specialInstructions) => {
    if (!specialInstructions)
        return null;
    const idx = specialInstructions.lastIndexOf(DELIVERY_META_PREFIX);
    if (idx === -1)
        return null;
    const raw = specialInstructions.slice(idx + DELIVERY_META_PREFIX.length).trim();
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
};
const withDeliveryMeta = (specialInstructions, meta) => {
    const raw = (specialInstructions || '').trim();
    const idx = raw.lastIndexOf(DELIVERY_META_PREFIX);
    const cleanInstructions = (idx === -1 ? raw : raw.slice(0, idx)).trim();
    const encoded = `${DELIVERY_META_PREFIX}${JSON.stringify(meta)}`;
    return cleanInstructions ? `${cleanInstructions}\n${encoded}` : encoded;
};
const mapDeliveryToOrderStatus = (deliveryStatus) => {
    switch (deliveryStatus) {
        case 'PLACED':
            return 'PENDING';
        case 'CONFIRMED':
            return 'CONFIRMED';
        case 'PREPARING':
            return 'PREPARING';
        case 'OUT_FOR_DELIVERY':
            return 'READY';
        case 'DELIVERED':
            return 'COMPLETED';
        case 'CANCELLED':
            return 'CANCELLED';
        default:
            return 'PENDING';
    }
};
const ensureDeliveryTable = async (restaurantId) => {
    const existing = await database_1.prisma.table.findFirst({
        where: {
            restaurantId,
            active: true,
            OR: [{ location: { equals: 'DELIVERY', mode: 'insensitive' } }, { location: { equals: 'Delivery', mode: 'insensitive' } }],
        },
    });
    if (existing)
        return existing;
    const maxNumberRow = await database_1.prisma.table.findFirst({
        where: { restaurantId },
        orderBy: { number: 'desc' },
        select: { number: true },
    });
    return database_1.prisma.table.create({
        data: {
            restaurantId,
            number: (maxNumberRow?.number || 0) + 1,
            capacity: 1,
            location: 'DELIVERY',
            active: true,
        },
    });
};
const notifyRestaurantOnOrderPlaced = async (restaurantId, payload) => {
    try {
        const restaurant = await database_1.prisma.restaurant.findUnique({
            where: { id: restaurantId },
            select: { name: true, phone: true },
        });
        if (!restaurant?.phone)
            return;
        await (0, sms_1.sendSMS)({
            to: restaurant.phone,
            message: `New delivery order #${payload.orderId.slice(0, 8).toUpperCase()} from ${payload.customerName} (${payload.customerPhone}) for INR ${toInr(payload.totalPaise)}. Please approve in POS.`,
        });
    }
    catch {
    }
};
const notifyOnDeliveryApproval = async (restaurantId, payload) => {
    try {
        const restaurant = await database_1.prisma.restaurant.findUnique({
            where: { id: restaurantId },
            select: { name: true, phone: true },
        });
        if (payload.customerPhone) {
            await (0, sms_1.sendSMS)({
                to: payload.customerPhone,
                message: `Hi ${payload.customerName}, your delivery order #${payload.orderId.slice(0, 8).toUpperCase()} has been approved by ${restaurant?.name || 'the restaurant'}. Total INR ${toInr(payload.totalPaise)}.`,
            });
        }
        if (restaurant?.phone) {
            await (0, sms_1.sendSMS)({
                to: restaurant.phone,
                message: `Delivery order #${payload.orderId.slice(0, 8).toUpperCase()} is approved and moved to CONFIRMED.`,
            });
        }
    }
    catch {
    }
};
router.post('/orders', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        const { items, customerName, customerPhone, deliveryAddress, landmark, specialInstructions, paymentProvider } = req.body;
        if (!customerName || !customerPhone || !deliveryAddress) {
            return res.status(400).json({
                success: false,
                error: 'customerName, customerPhone and deliveryAddress are required',
            });
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Items array cannot be empty' });
        }
        const allowedProviders = ['RAZORPAY', 'PAYTM', 'PHONEPE', 'CASH'];
        const selectedProvider = paymentProvider || 'RAZORPAY';
        if (!allowedProviders.includes(selectedProvider)) {
            return res.status(400).json({ success: false, error: 'Invalid payment provider' });
        }
        if (selectedProvider === 'CASH' && !req.restaurant.cashPaymentEnabled) {
            return res.status(400).json({ success: false, error: 'Cash payment is disabled by this restaurant' });
        }
        const deliveryTable = await ensureDeliveryTable(req.restaurant.id);
        const requestItems = items;
        const itemIds = requestItems.map((item) => item?.menuItemId).filter(Boolean);
        const menuItems = await database_1.prisma.menuItem.findMany({
            where: { restaurantId: req.restaurant.id, id: { in: itemIds } },
            select: { id: true, name: true, pricePaise: true, available: true },
        });
        const menuById = new Map(menuItems.map((item) => [item.id, item]));
        let subtotalPaise = 0;
        const orderItemsData = [];
        for (const [index, item] of requestItems.entries()) {
            if (!item?.menuItemId || typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: `Each item must include menuItemId and positive integer quantity. Invalid item at position ${index + 1}.`,
                });
            }
            const menuItem = menuById.get(item.menuItemId);
            if (!menuItem) {
                return res.status(400).json({ success: false, error: `Menu item with id ${item.menuItemId} not found` });
            }
            if (!menuItem.available) {
                return res.status(400).json({ success: false, error: `Menu item "${menuItem.name}" is unavailable` });
            }
            subtotalPaise += menuItem.pricePaise * item.quantity;
            orderItemsData.push({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                pricePaise: menuItem.pricePaise,
                notes: item.notes || '',
            });
        }
        const taxPaise = Math.round(subtotalPaise * TAX_RATE);
        const totalPaise = subtotalPaise + taxPaise;
        const deliveryMeta = {
            customerName: String(customerName).trim(),
            customerPhone: String(customerPhone).trim(),
            deliveryAddress: String(deliveryAddress).trim(),
            ...(landmark ? { landmark: String(landmark).trim() } : {}),
            deliveryStatus: 'PLACED',
        };
        const order = await database_1.prisma.order.create({
            data: {
                userId,
                restaurantId: req.restaurant.id,
                tableId: deliveryTable.id,
                subtotalPaise,
                taxPaise,
                totalPaise,
                discountPaise: 0,
                status: 'PENDING',
                paymentStatus: selectedProvider === 'CASH' ? 'PROCESSING' : 'PENDING',
                paymentProvider: selectedProvider,
                paidAmountPaise: 0,
                dueAmountPaise: totalPaise,
                paymentCollectionTiming: req.restaurant.paymentCollectionTiming,
                specialInstructions: withDeliveryMeta(specialInstructions, deliveryMeta),
                items: {
                    create: orderItemsData,
                },
            },
            include: {
                items: { include: { menuItem: true } },
                table: true,
                user: { select: { id: true, name: true, email: true } },
            },
        });
        (0, realtime_1.emitRestaurantEvent)(order.restaurantId, {
            type: 'order.created',
            userId: order.userId,
            payload: buildOrderEventPayload(order),
        });
        await notifyRestaurantOnOrderPlaced(order.restaurantId, {
            orderId: order.id,
            customerName: deliveryMeta.customerName,
            totalPaise: order.totalPaise,
            customerPhone: deliveryMeta.customerPhone,
        });
        return res.status(201).json({
            success: true,
            data: { ...order, deliveryMeta },
            message: 'Delivery order created successfully',
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to create delivery order' });
    }
});
router.get('/orders/restaurant/all', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const orders = await database_1.prisma.order.findMany({
            where: {
                restaurantId: req.restaurant.id,
                table: {
                    location: { equals: 'DELIVERY', mode: 'insensitive' },
                },
            },
            include: {
                items: { include: { menuItem: true } },
                table: true,
                user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        const enriched = orders.map((order) => {
            const deliveryMeta = parseDeliveryMeta(order.specialInstructions) || {
                customerName: 'Unknown',
                customerPhone: '',
                deliveryAddress: '',
                deliveryStatus: 'PLACED',
            };
            return { ...order, deliveryMeta };
        });
        return res.json({
            success: true,
            data: enriched,
            message: 'Delivery orders fetched successfully',
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch delivery orders' });
    }
});
router.get('/orders/my', async (req, res) => {
    try {
        if (!req.user?.id)
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        const orders = await database_1.prisma.order.findMany({
            where: {
                userId: req.user.id,
                restaurantId: req.restaurant.id,
                table: {
                    location: { equals: 'DELIVERY', mode: 'insensitive' },
                },
            },
            include: {
                items: { include: { menuItem: true } },
                table: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        const enriched = orders.map((order) => {
            const deliveryMeta = parseDeliveryMeta(order.specialInstructions) || {
                customerName: 'Unknown',
                customerPhone: '',
                deliveryAddress: '',
                deliveryStatus: 'PLACED',
            };
            return { ...order, deliveryMeta };
        });
        return res.json({
            success: true,
            data: enriched,
            message: 'Customer delivery orders fetched successfully',
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch your delivery orders' });
    }
});
router.put('/orders/:id/assign-rider', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const { id } = req.params;
        const { riderName, riderPhone } = req.body;
        if (!id)
            return res.status(400).json({ success: false, error: 'Order ID is required' });
        if (!riderName || !riderPhone) {
            return res.status(400).json({ success: false, error: 'riderName and riderPhone are required' });
        }
        const existingOrder = await database_1.prisma.order.findFirst({
            where: {
                id,
                restaurantId: req.restaurant.id,
                table: { location: { equals: 'DELIVERY', mode: 'insensitive' } },
            },
            include: {
                items: { include: { menuItem: true } },
                table: true,
                user: { select: { id: true, name: true, email: true } },
            },
        });
        if (!existingOrder)
            return res.status(404).json({ success: false, error: 'Delivery order not found' });
        const parsedMeta = parseDeliveryMeta(existingOrder.specialInstructions);
        if (!parsedMeta) {
            return res.status(400).json({ success: false, error: 'Delivery metadata missing on this order' });
        }
        const updatedMeta = {
            ...parsedMeta,
            riderName: riderName.trim(),
            riderPhone: riderPhone.trim(),
            deliveryStatus: parsedMeta.deliveryStatus === 'PLACED' ? 'CONFIRMED' : parsedMeta.deliveryStatus,
        };
        const updated = await database_1.prisma.order.update({
            where: { id: existingOrder.id },
            data: {
                status: mapDeliveryToOrderStatus(updatedMeta.deliveryStatus),
                specialInstructions: withDeliveryMeta(existingOrder.specialInstructions || '', updatedMeta),
            },
            include: {
                items: { include: { menuItem: true } },
                table: true,
                user: { select: { id: true, name: true, email: true } },
            },
        });
        (0, realtime_1.emitRestaurantEvent)(updated.restaurantId, {
            type: 'order.updated',
            userId: updated.userId,
            payload: buildOrderEventPayload(updated),
        });
        if (updatedMeta.deliveryStatus === 'CONFIRMED') {
            await notifyOnDeliveryApproval(updated.restaurantId, {
                orderId: updated.id,
                customerName: updatedMeta.customerName,
                customerPhone: updatedMeta.customerPhone,
                totalPaise: updated.totalPaise,
            });
        }
        return res.json({
            success: true,
            data: { ...updated, deliveryMeta: updatedMeta },
            message: 'Rider assigned successfully',
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to assign rider' });
    }
});
router.put('/orders/:id/status', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const { id } = req.params;
        const { deliveryStatus } = req.body;
        const allowed = [
            'PLACED',
            'CONFIRMED',
            'PREPARING',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'CANCELLED',
        ];
        if (!id)
            return res.status(400).json({ success: false, error: 'Order ID is required' });
        if (!deliveryStatus || !allowed.includes(deliveryStatus)) {
            return res.status(400).json({ success: false, error: 'Valid deliveryStatus is required' });
        }
        const existingOrder = await database_1.prisma.order.findFirst({
            where: {
                id,
                restaurantId: req.restaurant.id,
                table: { location: { equals: 'DELIVERY', mode: 'insensitive' } },
            },
            include: {
                items: { include: { menuItem: true } },
                table: true,
                user: { select: { id: true, name: true, email: true } },
            },
        });
        if (!existingOrder)
            return res.status(404).json({ success: false, error: 'Delivery order not found' });
        const parsedMeta = parseDeliveryMeta(existingOrder.specialInstructions);
        if (!parsedMeta) {
            return res.status(400).json({ success: false, error: 'Delivery metadata missing on this order' });
        }
        const updatedMeta = { ...parsedMeta, deliveryStatus };
        const updatedOrderStatus = mapDeliveryToOrderStatus(deliveryStatus);
        const updated = await database_1.prisma.order.update({
            where: { id: existingOrder.id },
            data: {
                status: updatedOrderStatus,
                paymentStatus: deliveryStatus === 'DELIVERED' ? 'COMPLETED' : existingOrder.paymentStatus,
                specialInstructions: withDeliveryMeta(existingOrder.specialInstructions || '', updatedMeta),
            },
            include: {
                items: { include: { menuItem: true } },
                table: true,
                user: { select: { id: true, name: true, email: true } },
            },
        });
        (0, realtime_1.emitRestaurantEvent)(updated.restaurantId, {
            type: 'order.updated',
            userId: updated.userId,
            payload: buildOrderEventPayload(updated),
        });
        if (deliveryStatus === 'CONFIRMED') {
            await notifyOnDeliveryApproval(updated.restaurantId, {
                orderId: updated.id,
                customerName: updatedMeta.customerName,
                customerPhone: updatedMeta.customerPhone,
                totalPaise: updated.totalPaise,
            });
        }
        return res.json({
            success: true,
            data: { ...updated, deliveryMeta: updatedMeta },
            message: 'Delivery status updated successfully',
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to update delivery status' });
    }
});
exports.default = router;
//# sourceMappingURL=delivery.js.map