"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../../middleware/auth");
const restaurant_1 = require("../../middleware/restaurant");
const database_1 = require("../../config/database");
const crm_service_1 = require("../../modules/crm/crm.service");
const router = (0, express_1.Router)();
const redeemSchema = zod_1.z.object({
    points: zod_1.z.number().int().positive(),
    reason: zod_1.z.string().max(200).optional(),
});
const customerQuerySchema = zod_1.z.object({
    q: zod_1.z.string().trim().max(100).optional(),
    tier: zod_1.z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
    segment: zod_1.z.enum(['NEW', 'LOYAL', 'HIGH_VALUE', 'AT_RISK', 'REGULAR']).optional(),
    minPoints: zod_1.z.coerce.number().int().nonnegative().optional(),
    sortBy: zod_1.z.enum(['LOYALTY', 'SPEND', 'LAST_ORDER']).optional(),
    direction: zod_1.z.enum(['asc', 'desc']).optional(),
    page: zod_1.z.coerce.number().int().min(1).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).optional(),
});
const notesSchema = zod_1.z.object({
    notes: zod_1.z.string().max(500).nullable(),
});
router.use(auth_1.authenticate, restaurant_1.requireRestaurant);
router.get('/customers', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const query = customerQuerySchema.parse(req.query);
        const q = query.q;
        const page = query.page || 1;
        const limit = query.limit || 60;
        const direction = query.direction || 'desc';
        const sortBy = query.sortBy || 'LOYALTY';
        const customers = await database_1.prisma.customerProfile.findMany({
            where: {
                restaurantId: req.restaurant.id,
                ...(query.tier ? { tier: query.tier } : {}),
                ...(typeof query.minPoints === 'number' ? { loyaltyPoints: { gte: query.minPoints } } : {}),
                ...(q
                    ? {
                        user: {
                            OR: [
                                { name: { contains: q, mode: 'insensitive' } },
                                { email: { contains: q, mode: 'insensitive' } },
                                { phone: { contains: q, mode: 'insensitive' } },
                            ],
                        },
                    }
                    : {}),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
            },
            orderBy: sortBy === 'SPEND'
                ? [{ totalSpendPaise: direction }]
                : sortBy === 'LAST_ORDER'
                    ? [{ lastOrderAt: direction }, { loyaltyPoints: 'desc' }]
                    : [{ loyaltyPoints: direction }, { totalSpendPaise: 'desc' }],
        });
        const enriched = customers
            .map((profile) => {
            const segment = (0, crm_service_1.classifyCrmSegment)(profile);
            const health = (0, crm_service_1.computeCrmHealth)(profile);
            return {
                ...profile,
                segment,
                health,
            };
        })
            .filter((profile) => (query.segment ? profile.segment === query.segment : true));
        const total = enriched.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const offset = (page - 1) * limit;
        const pagedData = enriched.slice(offset, offset + limit);
        return res.json({
            success: true,
            data: pagedData,
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
        }
        return res.status(500).json({ success: false, error: 'Failed to fetch customers' });
    }
});
router.get('/customers/overview', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    const profiles = await database_1.prisma.customerProfile.findMany({
        where: {
            restaurantId: req.restaurant.id,
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
        },
        orderBy: [{ totalSpendPaise: 'desc' }],
    });
    const enriched = profiles.map((profile) => {
        const segment = (0, crm_service_1.classifyCrmSegment)(profile);
        const health = (0, crm_service_1.computeCrmHealth)(profile);
        return {
            ...profile,
            segment,
            health,
        };
    });
    const summary = (0, crm_service_1.buildCrmSegmentsSummary)(enriched);
    const atRisk = enriched
        .filter((profile) => profile.health.risk === 'HIGH' || profile.segment === 'AT_RISK')
        .sort((a, b) => a.health.score - b.health.score)
        .slice(0, 10);
    const highValue = enriched
        .filter((profile) => profile.segment === 'HIGH_VALUE' || profile.segment === 'LOYAL')
        .sort((a, b) => b.totalSpendPaise - a.totalSpendPaise)
        .slice(0, 10);
    return res.json({
        success: true,
        data: {
            summary,
            atRisk,
            highValue,
        },
    });
});
router.get('/customers/:userId', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    const userId = req.params['userId'];
    const profile = await database_1.prisma.customerProfile.findUnique({
        where: {
            restaurantId_userId: {
                restaurantId: req.restaurant.id,
                userId,
            },
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
            loyaltyLedger: {
                orderBy: { createdAt: 'desc' },
                take: 20,
            },
            couponRedemptions: {
                orderBy: { redeemedAt: 'desc' },
                take: 20,
            },
        },
    });
    if (!profile) {
        return res.status(404).json({ success: false, error: 'Customer profile not found' });
    }
    const orderHistory = await database_1.prisma.order.findMany({
        where: {
            restaurantId: req.restaurant.id,
            userId,
        },
        include: {
            items: {
                include: {
                    menuItem: true,
                },
            },
            table: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
    });
    return res.json({ success: true, data: { profile, orderHistory } });
});
router.get('/me', async (req, res) => {
    if (!req.user?.id) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const profile = await database_1.prisma.customerProfile.findUnique({
        where: {
            restaurantId_userId: {
                restaurantId: req.restaurant.id,
                userId: req.user.id,
            },
        },
        include: {
            loyaltyLedger: {
                orderBy: { createdAt: 'desc' },
                take: 20,
            },
            couponRedemptions: {
                orderBy: { redeemedAt: 'desc' },
                take: 20,
            },
        },
    });
    return res.json({ success: true, data: profile });
});
router.patch('/customers/:userId/notes', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const userId = req.params['userId'];
        const payload = notesSchema.parse(req.body);
        const updated = await database_1.prisma.customerProfile.update({
            where: {
                restaurantId_userId: {
                    restaurantId: req.restaurant.id,
                    userId,
                },
            },
            data: {
                notes: payload.notes,
            },
        });
        return res.json({ success: true, data: updated, message: 'Customer notes updated' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        return res.status(500).json({ success: false, error: 'Failed to update customer notes' });
    }
});
router.post('/customers/:userId/redeem-points', (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), async (req, res) => {
    try {
        const userId = req.params['userId'];
        const payload = redeemSchema.parse(req.body);
        const updated = await database_1.prisma.$transaction(async (tx) => {
            const redeemPayload = {
                restaurantId: req.restaurant.id,
                userId,
                points: payload.points,
                createdByUserId: req.user?.id,
            };
            if (payload.reason)
                redeemPayload.reason = payload.reason;
            return (0, crm_service_1.redeemLoyaltyPoints)(tx, redeemPayload);
        });
        return res.json({ success: true, data: updated, message: 'Loyalty points redeemed' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        if (error instanceof Error) {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to redeem points' });
    }
});
exports.default = router;
//# sourceMappingURL=crm.routes.js.map