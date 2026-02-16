"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("@/config/database");
const auth_1 = require("@/middleware/auth");
const restaurant_1 = require("@/middleware/restaurant");
const router = (0, express_1.Router)();
const TAX_RATE = 0.08;
router.use(auth_1.authenticate);
const normalizeCouponCode = (code) => code.trim().toUpperCase();
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
    if (discountPaise > subtotalPaise) {
        discountPaise = subtotalPaise;
    }
    return { couponId: coupon.id, discountPaise, normalizedCode };
};
router.post('/', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const { tableId, items, specialInstructions, couponCode, paymentProvider } = req.body;
        const userId = req.user?.id;
        const allowedProviders = ['RAZORPAY', 'PAYTM', 'PHONEPE'];
        if (paymentProvider && !allowedProviders.includes(paymentProvider)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payment provider',
            });
        }
        console.log('Order request received:', JSON.stringify(req.body, null, 2));
        console.log('TableId:', tableId);
        console.log('Items:', items);
        console.log('Special instructions:', specialInstructions);
        console.log('UserId:', userId);
        console.log('Request headers:', req.headers);
        if (!tableId) {
            console.log('Validation failed: Missing tableId');
            return res.status(400).json({
                success: false,
                error: 'Missing required field: tableId'
            });
        }
        if (!items) {
            console.log('Validation failed: Missing items');
            return res.status(400).json({
                success: false,
                error: 'Missing required field: items'
            });
        }
        if (!Array.isArray(items)) {
            console.log('Validation failed: Items is not an array');
            return res.status(400).json({
                success: false,
                error: 'Items must be an array'
            });
        }
        if (items.length === 0) {
            console.log('Validation failed: Items array is empty');
            return res.status(400).json({
                success: false,
                error: 'Items array cannot be empty'
            });
        }
        console.log('Looking up table with ID:', tableId);
        const table = await database_1.prisma.table.findFirst({
            where: { id: tableId, restaurantId: req.restaurant.id }
        });
        console.log('Table lookup result:', table);
        if (!table) {
            console.log('Validation failed: Table not found');
            return res.status(400).json({
                success: false,
                error: 'Invalid table selected'
            });
        }
        if (!table.active) {
            console.log('Validation failed: Table is not active');
            return res.status(400).json({
                success: false,
                error: 'Selected table is not active'
            });
        }
        let subtotalPaise = 0;
        const orderItemsData = [];
        for (const [index, item] of items.entries()) {
            if (!item) {
                console.log(`Validation failed: Item at index ${index} is null or undefined`);
                return res.status(400).json({
                    success: false,
                    error: `Item at position ${index + 1} is invalid`
                });
            }
            if (!item.menuItemId || !item.quantity) {
                console.log('Validation failed: Invalid item structure', item);
                return res.status(400).json({
                    success: false,
                    error: `Each item must have menuItemId and quantity. Item at position ${index + 1} is missing required fields.`
                });
            }
            if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
                console.log('Validation failed: Invalid quantity', item);
                return res.status(400).json({
                    success: false,
                    error: `Quantity must be a positive integer. Item at position ${index + 1} has invalid quantity.`
                });
            }
            console.log(`Looking up menu item with ID: ${item.menuItemId}`);
            const menuItem = await database_1.prisma.menuItem.findFirst({
                where: { id: item.menuItemId, restaurantId: req.restaurant.id }
            });
            console.log(`Menu item lookup result for ${item.menuItemId}:`, menuItem);
            if (!menuItem) {
                console.log('Validation failed: Menu item not found', item.menuItemId);
                return res.status(400).json({
                    success: false,
                    error: `Menu item with id ${item.menuItemId} not found`
                });
            }
            if (!menuItem.available) {
                console.log('Validation failed: Menu item not available', item.menuItemId);
                return res.status(400).json({
                    success: false,
                    error: `Menu item "${menuItem.name}" is not available`
                });
            }
            const itemTotal = menuItem.pricePaise * item.quantity;
            subtotalPaise += itemTotal;
            orderItemsData.push({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                pricePaise: menuItem.pricePaise,
                notes: item.notes || ''
            });
        }
        let discountPaise = 0;
        let appliedCouponId;
        if (couponCode) {
            try {
                const couponResult = await applyCoupon(req.restaurant.id, couponCode, subtotalPaise);
                discountPaise = couponResult.discountPaise;
                appliedCouponId = couponResult.couponId;
            }
            catch (couponError) {
                return res.status(400).json({
                    success: false,
                    error: couponError?.message || 'Invalid coupon code',
                });
            }
        }
        const taxablePaise = Math.max(subtotalPaise - discountPaise, 0);
        const taxPaise = Math.round(taxablePaise * TAX_RATE);
        const totalPaise = taxablePaise + taxPaise;
        const order = await database_1.prisma.$transaction(async (tx) => {
            if (appliedCouponId) {
                await tx.coupon.update({
                    where: { id: appliedCouponId },
                    data: { usageCount: { increment: 1 } },
                });
            }
            return tx.order.create({
                data: {
                    userId: userId,
                    tableId,
                    restaurantId: req.restaurant.id,
                    subtotalPaise,
                    taxPaise,
                    discountPaise,
                    totalPaise,
                    paymentProvider: paymentProvider || 'RAZORPAY',
                    specialInstructions: specialInstructions || '',
                    couponId: appliedCouponId,
                    items: {
                        create: orderItemsData
                    }
                },
                include: {
                    items: {
                        include: {
                            menuItem: true
                        }
                    },
                    table: true
                }
            });
        });
        return res.status(201).json({
            success: true,
            data: order,
            message: 'Order created successfully'
        });
    }
    catch (error) {
        console.error('Error creating order:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while creating order'
        });
    }
});
router.get('/', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const userId = req.user?.id;
        const orders = await database_1.prisma.order.findMany({
            where: {
                userId,
                restaurantId: req.restaurant.id,
            },
            include: {
                items: {
                    include: {
                        menuItem: true
                    }
                },
                table: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return res.json({
            success: true,
            data: orders
        });
    }
    catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while fetching orders'
        });
    }
});
router.get('/restaurant/all', restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const orders = await database_1.prisma.order.findMany({
            where: {
                restaurantId: req.restaurant.id,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                items: {
                    include: {
                        menuItem: true,
                    },
                },
                table: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return res.json({
            success: true,
            data: orders,
            message: 'Restaurant orders retrieved successfully',
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Internal server error while fetching restaurant orders',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/:id', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const order = await database_1.prisma.order.findFirst({
            where: {
                id,
                userId,
                restaurantId: req.restaurant.id,
            },
            include: {
                items: {
                    include: {
                        menuItem: true
                    }
                },
                table: true
            }
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        return res.json({
            success: true,
            data: order
        });
    }
    catch (error) {
        console.error('Error fetching order:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while fetching order'
        });
    }
});
router.put('/:id/status', restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'Status is required',
            });
        }
        const existing = await database_1.prisma.order.findFirst({
            where: { id, restaurantId: req.restaurant.id },
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Order not found',
            });
        }
        const order = await database_1.prisma.order.update({
            where: { id },
            data: { status },
            include: {
                items: {
                    include: {
                        menuItem: true,
                    },
                },
                table: true,
            },
        });
        return res.json({
            success: true,
            data: order,
            message: 'Order status updated',
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to update order status',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.put('/:id/cancel', restaurant_1.requireRestaurant, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const order = await database_1.prisma.order.findFirst({
            where: { id, userId, restaurantId: req.restaurant.id },
            select: { status: true },
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found',
            });
        }
        if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                error: 'Order cannot be cancelled at this stage',
            });
        }
        const cancelled = await database_1.prisma.order.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                paymentStatus: 'FAILED',
            },
        });
        return res.json({
            success: true,
            data: cancelled,
            message: 'Order cancelled',
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to cancel order',
        });
    }
});
exports.default = router;
//# sourceMappingURL=orders.js.map