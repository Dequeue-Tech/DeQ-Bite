"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const restaurant_1 = require("../../middleware/restaurant");
const pos_service_1 = require("../../modules/pos/pos.service");
const inventory_service_1 = require("../../modules/inventory/inventory.service");
const database_1 = require("../../config/database");
const router = (0, express_1.Router)();
const createPosOrderSchema = zod_1.z.object({
    sourceSystem: zod_1.z.string().min(2).max(60),
    externalOrderId: zod_1.z.string().max(120).optional(),
    userId: zod_1.z.string().min(1),
    tableId: zod_1.z.string().min(1),
    items: zod_1.z.array(zod_1.z.object({
        menuItemId: zod_1.z.string().min(1),
        quantity: zod_1.z.number().int().positive(),
        notes: zod_1.z.string().max(200).optional(),
    })).min(1),
    specialInstructions: zod_1.z.string().max(400).optional(),
    couponCode: zod_1.z.string().max(40).optional(),
    paymentProvider: zod_1.z.enum(['RAZORPAY', 'PAYTM', 'PHONEPE', 'CASH']).optional(),
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
            createdByUserId: req.user?.id,
            items: payload.items.map((item) => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                notes: item.notes,
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
router.get('/sync/logs', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    const logs = await database_1.prisma.posSyncLog.findMany({
        where: {
            restaurantId: req.restaurant.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    return res.json({ success: true, data: logs });
});
exports.default = router;
//# sourceMappingURL=pos.routes.js.map