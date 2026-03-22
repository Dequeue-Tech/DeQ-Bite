"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const auth_1 = require("../../middleware/auth");
const restaurant_1 = require("../../middleware/restaurant");
const analytics_service_1 = require("../../modules/analytics/analytics.service");
const database_1 = require("../../config/database");
const router = (0, express_1.Router)();
const dateQuerySchema = zod_1.z.object({
    date: zod_1.z.string().optional(),
});
const overviewQuerySchema = zod_1.z.object({
    start: zod_1.z.string().optional(),
    end: zod_1.z.string().optional(),
});
const parseDateInput = (value) => {
    if (!value)
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid date format');
    }
    return date;
};
router.use(auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'));
router.get('/daily', async (req, res) => {
    try {
        const query = dateQuerySchema.parse(req.query);
        const date = parseDateInput(query.date) || new Date();
        const snapshot = await (0, analytics_service_1.generateAnalyticsSnapshot)({
            restaurantId: req.restaurant.id,
            periodType: client_1.AnalyticsPeriodType.DAILY,
            date,
        });
        return res.json({ success: true, data: snapshot });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
        }
        if (error instanceof Error && error.message === 'Invalid date format') {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to generate daily analytics' });
    }
});
router.get('/weekly', async (req, res) => {
    try {
        const query = dateQuerySchema.parse(req.query);
        const date = parseDateInput(query.date) || new Date();
        const snapshot = await (0, analytics_service_1.generateAnalyticsSnapshot)({
            restaurantId: req.restaurant.id,
            periodType: client_1.AnalyticsPeriodType.WEEKLY,
            date,
        });
        return res.json({ success: true, data: snapshot });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
        }
        if (error instanceof Error && error.message === 'Invalid date format') {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to generate weekly analytics' });
    }
});
router.get('/overview', async (req, res) => {
    try {
        const query = overviewQuerySchema.parse(req.query);
        const end = parseDateInput(query.end) || new Date();
        const start = parseDateInput(query.start) || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        const overview = await (0, analytics_service_1.getAnalyticsOverview)({
            restaurantId: req.restaurant.id,
            start,
            end,
        });
        return res.json({ success: true, data: overview });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
        }
        if (error instanceof Error) {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to generate analytics overview' });
    }
});
router.get('/history', async (req, res) => {
    const snapshots = await database_1.prisma.analyticsSnapshot.findMany({
        where: {
            restaurantId: req.restaurant.id,
        },
        orderBy: { generatedAt: 'desc' },
        take: 30,
    });
    return res.json({ success: true, data: snapshots });
});
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map