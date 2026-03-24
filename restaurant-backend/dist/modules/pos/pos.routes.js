"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("@/middleware/auth");
const restaurant_1 = require("@/middleware/restaurant");
const pos_service_1 = require("@/modules/pos/pos.service");
const inventory_service_1 = require("@/modules/inventory/inventory.service");
const database_1 = require("@/config/database");
const router = (0, express_1.Router)();
const marketplaceSourceSchema = zod_1.z.enum(['ZOMATO', 'SWIGGY']);
const createPosOrderSchema = zod_1.z.object({
    sourceSystem: zod_1.z.string().min(2).max(60),
    externalOrderId: zod_1.z.string().max(120).optional(),
    userId: zod_1.z.string().min(1),
    tableId: zod_1.z.string().min(1),
    items: zod_1.z
        .array(zod_1.z.object({
        menuItemId: zod_1.z.string().min(1),
        quantity: zod_1.z.number().int().positive(),
        notes: zod_1.z.string().max(200).optional(),
    }))
        .min(1),
    specialInstructions: zod_1.z.string().max(400).optional(),
    couponCode: zod_1.z.string().max(40).optional(),
    paymentProvider: zod_1.z.enum(['RAZORPAY', 'PAYTM', 'PHONEPE', 'CASH']).optional(),
});
const marketplaceOrderSchema = zod_1.z.object({
    externalOrderId: zod_1.z.string().min(1).max(120),
    customer: zod_1.z.object({
        name: zod_1.z.string().min(1).max(80),
        phone: zod_1.z.string().max(25).optional(),
        email: zod_1.z.string().email().max(120).optional(),
        address: zod_1.z.string().min(1).max(240),
        landmark: zod_1.z.string().max(120).optional(),
    }),
    items: zod_1.z
        .array(zod_1.z
        .object({
        menuItemId: zod_1.z.string().max(120).optional(),
        menuItemName: zod_1.z.string().max(120).optional(),
        quantity: zod_1.z.number().int().positive(),
        notes: zod_1.z.string().max(200).optional(),
    })
        .superRefine((item, ctx) => {
        const hasId = Boolean(item.menuItemId && item.menuItemId.trim());
        const hasName = Boolean(item.menuItemName && item.menuItemName.trim());
        if (!hasId && !hasName) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Each item must include either menuItemId or menuItemName',
            });
        }
    }))
        .min(1),
    specialInstructions: zod_1.z.string().max(400).optional(),
    paymentProvider: zod_1.z.enum(['RAZORPAY', 'PAYTM', 'PHONEPE', 'CASH']).optional(),
    paymentStatus: zod_1.z
        .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_PAID'])
        .optional(),
    paidAmountPaise: zod_1.z.number().int().min(0).optional(),
});
const marketplaceQuerySchema = zod_1.z.object({
    sourceSystem: marketplaceSourceSchema.optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional(),
});
router.use(auth_1.authenticate, restaurant_1.requireRestaurant);
router.post('/sync/orders', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const payload = createPosOrderSchema.parse(req.body);
        const createPayload = {
            restaurantId: req.restaurant.id,
            userId: payload.userId,
            tableId: payload.tableId,
            sourceSystem: payload.sourceSystem,
            items: payload.items.map((item) => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                ...(item.notes ? { notes: item.notes } : {}),
            })),
        };
        if (payload.externalOrderId)
            createPayload.externalOrderId = payload.externalOrderId;
        if (payload.specialInstructions)
            createPayload.specialInstructions = payload.specialInstructions;
        if (payload.couponCode)
            createPayload.couponCode = payload.couponCode;
        if (payload.paymentProvider)
            createPayload.paymentProvider = payload.paymentProvider;
        if (req.user?.id)
            createPayload.createdByUserId = req.user.id;
        const created = await (0, pos_service_1.createIntegratedPosOrder)(createPayload);
        const replayed = Boolean(created.idempotentReplay);
        return res.status(replayed ? 200 : 201).json({
            success: true,
            data: created,
            message: replayed
                ? 'POS order already synced. Returning existing operational workflow state'
                : 'POS order synced and operational workflows completed',
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        if (error instanceof inventory_service_1.InventoryError) {
            return res.status(error.statusCode).json({ success: false, error: error.message, details: error.details });
        }
        if (error instanceof Error) {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to sync POS order' });
    }
});
router.post('/integrations/:platform/orders', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const platform = marketplaceSourceSchema.parse(String(req.params['platform'] || '').toUpperCase());
        const payload = marketplaceOrderSchema.parse(req.body);
        const customerPayload = {
            name: payload.customer.name,
            address: payload.customer.address,
            ...(payload.customer.phone ? { phone: payload.customer.phone } : {}),
            ...(payload.customer.email ? { email: payload.customer.email } : {}),
            ...(payload.customer.landmark ? { landmark: payload.customer.landmark } : {}),
        };
        const itemsPayload = payload.items.map((item) => ({
            quantity: item.quantity,
            ...(item.menuItemId ? { menuItemId: item.menuItemId } : {}),
            ...(item.menuItemName ? { menuItemName: item.menuItemName } : {}),
            ...(item.notes ? { notes: item.notes } : {}),
        }));
        const createPayload = {
            restaurantId: req.restaurant.id,
            sourceSystem: platform,
            externalOrderId: payload.externalOrderId,
            customer: customerPayload,
            items: itemsPayload,
            ...(payload.specialInstructions ? { specialInstructions: payload.specialInstructions } : {}),
            ...(payload.paymentProvider ? { paymentProvider: payload.paymentProvider } : {}),
            ...(payload.paymentStatus ? { paymentStatus: payload.paymentStatus } : {}),
            ...(typeof payload.paidAmountPaise === 'number' ? { paidAmountPaise: payload.paidAmountPaise } : {}),
            ...(req.user?.id ? { createdByUserId: req.user.id } : {}),
        };
        const created = await (0, pos_service_1.createMarketplaceIntegratedOrder)(createPayload);
        const replayed = Boolean(created.idempotentReplay);
        return res.status(replayed ? 200 : 201).json({
            success: true,
            data: created,
            message: replayed
                ? `${platform} order already integrated. Returning existing workflow state`
                : `${platform} order integrated successfully`,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        if (error instanceof inventory_service_1.InventoryError) {
            return res.status(error.statusCode).json({ success: false, error: error.message, details: error.details });
        }
        if (error instanceof Error) {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to integrate marketplace order' });
    }
});
router.get('/integrations/orders', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const parsed = marketplaceQuerySchema.parse({
            sourceSystem: req.query['sourceSystem'] ? String(req.query['sourceSystem']).toUpperCase() : undefined,
            limit: req.query['limit'],
        });
        const queryPayload = {
            restaurantId: req.restaurant.id,
            ...(parsed.sourceSystem ? { sourceSystem: parsed.sourceSystem } : {}),
            ...(typeof parsed.limit === 'number' ? { limit: parsed.limit } : {}),
        };
        const orders = await (0, pos_service_1.getMarketplaceIntegratedOrders)(queryPayload);
        return res.json({
            success: true,
            data: orders,
            message: 'Marketplace integrated orders fetched successfully',
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid query params', details: error.issues });
        }
        if (error instanceof Error) {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to fetch marketplace orders' });
    }
});
router.get('/sync/logs', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    const sourceSystem = req.query['sourceSystem'] ? String(req.query['sourceSystem']) : null;
    const logs = await database_1.prisma.posSyncLog.findMany({
        where: {
            restaurantId: req.restaurant.id,
            ...(sourceSystem ? { sourceSystem } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    return res.json({ success: true, data: logs });
});
exports.default = router;
//# sourceMappingURL=pos.routes.js.map