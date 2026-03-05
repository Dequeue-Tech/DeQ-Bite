"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const restaurant_1 = require("../middleware/restaurant");
const router = (0, express_1.Router)();
const TAX_RATE = 0.08;
router.use(auth_1.authenticate);
const normalizeCouponCode = (code) => code.trim().toUpperCase();
const calculateDiscountFromCoupon = (coupon, subtotalPaise) => {
    if (!coupon || !coupon.active)
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
const applyCoupon = async (restaurantId, code, subtotalPaise) => {
    const normalizedCode = normalizeCouponCode(code);
    const coupon = await database_1.prisma.coupon.findFirst({
        where: {
            restaurantId,
            code: normalizedCode,
            active: true,
        },
    });
    if (!coupon) {
        throw new Error('Invalid or inactive coupon code');
    }
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
        throw new Error('Coupon is not active yet');
    }
    if (coupon.endsAt && coupon.endsAt < now) {
        throw new Error('Coupon has expired');
    }
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        throw new Error('Coupon usage limit reached');
    }
    if (coupon.minOrderPaise && subtotalPaise < coupon.minOrderPaise) {
        throw new Error('Order total does not meet coupon minimum');
    }
    const discountPaise = calculateDiscountFromCoupon(coupon, subtotalPaise);
    return { couponId: coupon.id, discountPaise, normalizedCode };
};
router.post('/', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const { tableId, items, specialInstructions, couponCode, paymentProvider } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        if (!tableId) {
            return res.status(400).json({ success: false, error: 'Missing required field: tableId' });
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
        const table = await database_1.prisma.table.findFirst({
            where: { id: tableId, restaurantId: req.restaurant.id },
        });
        if (!table || !table.active) {
            return res.status(400).json({ success: false, error: 'Invalid table selected' });
        }
        let subtotalPaise = 0;
        const orderItemsData = [];
        for (const [index, item] of items.entries()) {
            if (!item?.menuItemId || !item?.quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Each item must have menuItemId and quantity. Item at position ${index + 1} is invalid.`,
                });
            }
            if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
                return res.status(400).json({
                    success: false,
                    error: `Quantity must be a positive integer. Item at position ${index + 1} has invalid quantity.`,
                });
            }
            const menuItem = await database_1.prisma.menuItem.findFirst({
                where: { id: item.menuItemId, restaurantId: req.restaurant.id },
            });
            if (!menuItem) {
                return res.status(400).json({ success: false, error: `Menu item with id ${item.menuItemId} not found` });
            }
            if (!menuItem.available) {
                return res.status(400).json({ success: false, error: `Menu item "${menuItem.name}" is not available` });
            }
            subtotalPaise += menuItem.pricePaise * item.quantity;
            orderItemsData.push({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                pricePaise: menuItem.pricePaise,
                notes: item.notes || '',
            });
        }
        let discountPaise = 0;
        let appliedCouponId = null;
        if (couponCode) {
            try {
                const couponResult = await applyCoupon(req.restaurant.id, couponCode, subtotalPaise);
                discountPaise = couponResult.discountPaise;
                appliedCouponId = couponResult.couponId;
            }
            catch (couponError) {
                return res.status(400).json({ success: false, error: couponError?.message || 'Invalid coupon code' });
            }
        }
        const taxablePaise = Math.max(subtotalPaise - discountPaise, 0);
        const taxPaise = Math.round(taxablePaise * TAX_RATE);
        const totalPaise = taxablePaise + taxPaise;
        const paymentCollectionTiming = req.restaurant.paymentCollectionTiming;
        const status = paymentCollectionTiming === 'AFTER_MEAL' ? 'CONFIRMED' : 'PENDING';
        const initialPaymentStatus = selectedProvider === 'CASH' && paymentCollectionTiming === 'BEFORE_MEAL' ? 'PROCESSING' : 'PENDING';
        const order = await database_1.prisma.$transaction(async (tx) => {
            if (appliedCouponId) {
                await tx.coupon.update({
                    where: { id: appliedCouponId },
                    data: { usageCount: { increment: 1 } },
                });
            }
            return tx.order.create({
                data: {
                    userId,
                    tableId,
                    restaurantId: req.restaurant.id,
                    subtotalPaise,
                    taxPaise,
                    discountPaise,
                    totalPaise,
                    paymentProvider: selectedProvider,
                    paymentStatus: initialPaymentStatus,
                    paidAmountPaise: 0,
                    dueAmountPaise: totalPaise,
                    paymentCollectionTiming,
                    specialInstructions: specialInstructions || '',
                    couponId: appliedCouponId,
                    status,
                    items: {
                        create: orderItemsData,
                    },
                },
                include: {
                    items: { include: { menuItem: true } },
                    table: true,
                },
            });
        });
        return res.status(201).json({ success: true, data: order, message: 'Order created successfully' });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Internal server error while creating order' });
    }
});
router.post('/:id/items', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const { items, specialInstructions } = req.body;
        if (!id || !userId) {
            return res.status(400).json({ success: false, error: 'Order ID is required' });
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Items array cannot be empty' });
        }
        const existingOrder = await database_1.prisma.order.findFirst({
            where: { id, userId, restaurantId: req.restaurant.id },
            include: {
                items: true,
                coupon: true,
            },
        });
        if (!existingOrder) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        if (['COMPLETED', 'CANCELLED'].includes(existingOrder.status)) {
            return res.status(400).json({ success: false, error: 'Cannot add dishes to a closed order' });
        }
        const additionalItems = [];
        let addedSubtotalPaise = 0;
        for (const [index, item] of items.entries()) {
            if (!item?.menuItemId || !item?.quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Each item must have menuItemId and quantity. Item at position ${index + 1} is invalid.`,
                });
            }
            if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
                return res.status(400).json({
                    success: false,
                    error: `Quantity must be a positive integer. Item at position ${index + 1} has invalid quantity.`,
                });
            }
            const menuItem = await database_1.prisma.menuItem.findFirst({
                where: { id: item.menuItemId, restaurantId: req.restaurant.id },
            });
            if (!menuItem || !menuItem.available) {
                return res.status(400).json({ success: false, error: `Menu item at position ${index + 1} is not available` });
            }
            addedSubtotalPaise += menuItem.pricePaise * item.quantity;
            additionalItems.push({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                pricePaise: menuItem.pricePaise,
                notes: item.notes || '',
            });
        }
        const updatedSubtotal = existingOrder.subtotalPaise + addedSubtotalPaise;
        const updatedDiscount = calculateDiscountFromCoupon(existingOrder.coupon, updatedSubtotal);
        const taxablePaise = Math.max(updatedSubtotal - updatedDiscount, 0);
        const updatedTax = Math.round(taxablePaise * TAX_RATE);
        const updatedTotal = taxablePaise + updatedTax;
        const updatedOrder = await database_1.prisma.$transaction(async (tx) => {
            await tx.orderItem.createMany({
                data: additionalItems.map((item) => ({
                    orderId: existingOrder.id,
                    menuItemId: item.menuItemId,
                    quantity: item.quantity,
                    pricePaise: item.pricePaise,
                    notes: item.notes,
                })),
            });
            const updatedDue = Math.max(updatedTotal - existingOrder.paidAmountPaise, 0);
            const updatedPaymentStatus = updatedDue === 0
                ? 'COMPLETED'
                : existingOrder.paidAmountPaise > 0
                    ? 'PARTIALLY_PAID'
                    : 'PENDING';
            return tx.order.update({
                where: { id: existingOrder.id },
                data: {
                    subtotalPaise: updatedSubtotal,
                    discountPaise: updatedDiscount,
                    taxPaise: updatedTax,
                    totalPaise: updatedTotal,
                    dueAmountPaise: updatedDue,
                    paymentStatus: updatedPaymentStatus,
                    status: existingOrder.paymentCollectionTiming === 'AFTER_MEAL' ? 'CONFIRMED' : existingOrder.status,
                    specialInstructions: typeof specialInstructions === 'string' ? specialInstructions : existingOrder.specialInstructions,
                },
                include: {
                    items: { include: { menuItem: true } },
                    table: true,
                },
            });
        });
        return res.status(200).json({
            success: true,
            data: updatedOrder,
            message: 'Dishes added to ongoing meal',
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Internal server error while adding dishes' });
    }
});
router.post('/:id/apply-coupon', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const { id } = req.params;
        const { couponCode } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Order ID is required' });
        }
        if (!couponCode || !couponCode.trim()) {
            return res.status(400).json({ success: false, error: 'Coupon code is required' });
        }
        if (!req.user?.id) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const existingOrder = await database_1.prisma.order.findFirst({
            where: {
                id,
                userId: req.user.id,
                restaurantId: req.restaurant.id,
            },
            include: {
                coupon: true,
            },
        });
        if (!existingOrder) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        if (existingOrder.paymentStatus === 'COMPLETED') {
            return res.status(400).json({ success: false, error: 'Cannot apply coupon on a paid order' });
        }
        const couponResult = await applyCoupon(req.restaurant.id, couponCode, existingOrder.subtotalPaise);
        const newDiscount = couponResult.discountPaise;
        const taxablePaise = Math.max(existingOrder.subtotalPaise - newDiscount, 0);
        const newTax = Math.round(taxablePaise * TAX_RATE);
        const newTotal = taxablePaise + newTax;
        const updatedOrder = await database_1.prisma.$transaction(async (tx) => {
            if (existingOrder.couponId !== couponResult.couponId) {
                await tx.coupon.update({
                    where: { id: couponResult.couponId },
                    data: { usageCount: { increment: 1 } },
                });
            }
            const updatedDue = Math.max(newTotal - existingOrder.paidAmountPaise, 0);
            const updatedPaymentStatus = updatedDue === 0
                ? 'COMPLETED'
                : existingOrder.paidAmountPaise > 0
                    ? 'PARTIALLY_PAID'
                    : 'PENDING';
            return tx.order.update({
                where: { id: existingOrder.id },
                data: {
                    couponId: couponResult.couponId,
                    discountPaise: newDiscount,
                    taxPaise: newTax,
                    totalPaise: newTotal,
                    dueAmountPaise: updatedDue,
                    paymentStatus: updatedPaymentStatus,
                },
                include: {
                    items: { include: { menuItem: true } },
                    table: true,
                },
            });
        });
        return res.json({
            success: true,
            data: updatedOrder,
            message: 'Coupon applied successfully',
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            error: error?.message || 'Failed to apply coupon',
        });
    }
});
router.get('/', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const userId = req.user.id;
        const orders = await database_1.prisma.order.findMany({
            where: {
                userId,
                restaurantId: req.restaurant.id,
            },
            include: {
                items: { include: { menuItem: true } },
                table: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return res.json({ success: true, data: orders });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Internal server error while fetching orders' });
    }
});
router.get('/restaurant/all', restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const orders = await database_1.prisma.order.findMany({
            where: {
                restaurantId: req.restaurant.id,
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                items: { include: { menuItem: true } },
                table: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return res.json({ success: true, data: orders, message: 'Restaurant orders retrieved successfully' });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Internal server error while fetching restaurant orders' });
    }
});
router.get('/:id', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Order ID is required' });
        }
        if (!req.user?.id) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const userId = req.user.id;
        const order = await database_1.prisma.order.findFirst({
            where: {
                id,
                userId,
                restaurantId: req.restaurant.id,
            },
            include: {
                items: { include: { menuItem: true } },
                table: true,
            },
        });
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        return res.json({ success: true, data: order });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Internal server error while fetching order' });
    }
});
router.put('/:id/status', restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Order ID is required' });
        }
        if (!status) {
            return res.status(400).json({ success: false, error: 'Status is required' });
        }
        const existing = await database_1.prisma.order.findFirst({ where: { id, restaurantId: req.restaurant.id } });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        if (existing.paymentCollectionTiming === 'BEFORE_MEAL' &&
            existing.paymentStatus !== 'COMPLETED' &&
            ['CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Payment must be completed before this order can proceed',
            });
        }
        const order = await database_1.prisma.order.update({
            where: { id },
            data: { status: status },
            include: {
                items: { include: { menuItem: true } },
                table: true,
            },
        });
        return res.json({ success: true, data: order, message: 'Order status updated' });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to update order status' });
    }
});
router.put('/:id/cancel', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Order ID is required' });
        }
        if (!req.user?.id) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const userId = req.user.id;
        const order = await database_1.prisma.order.findFirst({
            where: { id, userId, restaurantId: req.restaurant.id },
            select: { status: true, paidAmountPaise: true },
        });
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
            return res.status(400).json({ success: false, error: 'Order cannot be cancelled at this stage' });
        }
        if (order.paidAmountPaise > 0) {
            return res.status(400).json({
                success: false,
                error: 'Order has payment captured. Refund the payment before cancellation.',
            });
        }
        const cancelled = await database_1.prisma.order.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                paymentStatus: 'FAILED',
            },
        });
        return res.json({ success: true, data: cancelled, message: 'Order cancelled' });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to cancel order' });
    }
});
exports.default = router;
//# sourceMappingURL=orders.js.map