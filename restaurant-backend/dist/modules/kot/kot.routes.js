"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const auth_1 = require("@/middleware/auth");
const restaurant_1 = require("@/middleware/restaurant");
const database_1 = require("@/config/database");
const kot_service_1 = require("@/modules/kot/kot.service");
const router = (0, express_1.Router)();
const statusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.KOTStatus),
    note: zod_1.z.string().max(300).optional(),
});
const summaryQuerySchema = zod_1.z.object({
    overdueMinutes: zod_1.z.coerce.number().int().min(5).max(180).optional(),
});
const prioritySchema = zod_1.z.object({
    priority: zod_1.z.number().int().min(-5).max(5),
    note: zod_1.z.string().max(300).optional(),
});
router.use(auth_1.authenticate, restaurant_1.requireRestaurant);
router.get('/tickets', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    const status = req.query['status'];
    const tickets = await database_1.prisma.kOTTicket.findMany({
        where: {
            restaurantId: req.restaurant.id,
            ...(status ? { status } : {}),
        },
        include: {
            order: {
                include: {
                    table: true,
                    items: { include: { menuItem: true } },
                },
            },
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
    });
    return res.json({ success: true, data: tickets });
});
router.get('/summary', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const query = summaryQuerySchema.parse(req.query);
        const summaryPayload = {
            restaurantId: req.restaurant.id,
        };
        if (typeof query.overdueMinutes === 'number') {
            summaryPayload.overdueThresholdMinutes = query.overdueMinutes;
        }
        const summary = await (0, kot_service_1.getKOTOperationalSummary)(summaryPayload);
        return res.json({ success: true, data: summary });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
        }
        return res.status(500).json({ success: false, error: 'Failed to fetch KOT summary' });
    }
});
router.get('/tickets/order/:orderId', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    const orderId = req.params['orderId'];
    const ticket = await database_1.prisma.kOTTicket.findFirst({
        where: { restaurantId: req.restaurant.id, orderId },
        include: {
            order: {
                include: {
                    table: true,
                    items: { include: { menuItem: true } },
                },
            },
            events: {
                orderBy: { changedAt: 'asc' },
            },
        },
    });
    if (!ticket) {
        return res.status(404).json({ success: false, error: 'KOT ticket not found' });
    }
    return res.json({ success: true, data: ticket });
});
router.patch('/tickets/order/:orderId/status', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const orderId = req.params['orderId'];
        const payload = statusSchema.parse(req.body);
        const updatePayload = {
            restaurantId: req.restaurant.id,
            orderId,
            status: payload.status,
        };
        if (payload.note)
            updatePayload.note = payload.note;
        if (req.user?.id)
            updatePayload.changedByUserId = req.user.id;
        const updated = await (0, kot_service_1.updateKOTStatus)(updatePayload);
        return res.json({ success: true, data: updated, message: 'KOT status updated' });
    }
    catch (error) {
        if (error instanceof kot_service_1.KOTError) {
            return res.status(error.statusCode).json({ success: false, error: error.message });
        }
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        return res.status(500).json({ success: false, error: 'Failed to update KOT status' });
    }
});
router.patch('/tickets/order/:orderId/priority', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const orderId = req.params['orderId'];
        const payload = prioritySchema.parse(req.body);
        const updatePayload = {
            restaurantId: req.restaurant.id,
            orderId,
            priority: payload.priority,
        };
        if (payload.note)
            updatePayload.note = payload.note;
        if (req.user?.id)
            updatePayload.changedByUserId = req.user.id;
        const updated = await (0, kot_service_1.updateKOTPriority)(updatePayload);
        return res.json({ success: true, data: updated, message: 'KOT priority updated' });
    }
    catch (error) {
        if (error instanceof kot_service_1.KOTError) {
            return res.status(error.statusCode).json({ success: false, error: error.message });
        }
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        return res.status(500).json({ success: false, error: 'Failed to update KOT priority' });
    }
});
exports.default = router;
//# sourceMappingURL=kot.routes.js.map