"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const updateRestaurantStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['APPROVED', 'SUSPENDED']),
    suspendedReason: zod_1.z.string().max(500).optional(),
});
const updateCommissionSchema = zod_1.z.object({
    commissionRate: zod_1.z.number().min(0).max(100),
});
const updateRestaurantDetailsSchema = zod_1.z.object({
    gstNumber: zod_1.z.string().max(40).optional(),
    bankAccountName: zod_1.z.string().max(120).optional(),
    bankAccountNumber: zod_1.z.string().max(40).optional(),
    bankIfsc: zod_1.z.string().max(20).optional(),
    address: zod_1.z.string().max(250).optional(),
    city: zod_1.z.string().max(80).optional(),
    state: zod_1.z.string().max(80).optional(),
    country: zod_1.z.string().max(80).optional(),
});
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)('OWNER'));
router.get('/restaurants', async (req, res) => {
    const status = req.query['status'];
    const restaurants = await database_1.prisma.restaurant.findMany({
        where: {
            ...(status && ['PENDING_APPROVAL', 'APPROVED', 'SUSPENDED'].includes(status)
                ? { status: status }
                : {}),
        },
        select: {
            id: true,
            name: true,
            slug: true,
            subdomain: true,
            status: true,
            active: true,
            commissionRate: true,
            gstNumber: true,
            city: true,
            state: true,
            createdAt: true,
            approvedAt: true,
            _count: {
                select: {
                    orders: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    return res.json({
        success: true,
        data: { restaurants },
    });
});
router.patch('/restaurants/:id/status', async (req, res) => {
    const restaurantId = req.params['id'];
    if (!restaurantId) {
        return res.status(400).json({ success: false, error: 'Restaurant id is required' });
    }
    const payload = updateRestaurantStatusSchema.parse(req.body);
    const restaurant = await database_1.prisma.restaurant.update({
        where: { id: restaurantId },
        data: {
            status: payload.status,
            active: payload.status !== 'SUSPENDED',
            approvedAt: payload.status === 'APPROVED' ? new Date() : null,
            approvedByUserId: payload.status === 'APPROVED' ? req.user.id : null,
            suspendedReason: payload.status === 'SUSPENDED' ? payload.suspendedReason || 'Suspended by platform admin' : null,
        },
        select: {
            id: true,
            name: true,
            status: true,
            active: true,
            suspendedReason: true,
            approvedAt: true,
            approvedByUserId: true,
        },
    });
    await database_1.prisma.auditLog.create({
        data: {
            actorUserId: req.user.id,
            restaurantId,
            action: `PLATFORM_RESTAURANT_${payload.status}`,
            entityType: 'restaurant',
            entityId: restaurantId,
            metadata: payload,
        },
    });
    return res.json({
        success: true,
        data: { restaurant },
        message: `Restaurant ${payload.status.toLowerCase()} successfully`,
    });
});
router.patch('/restaurants/:id/commission', async (req, res) => {
    const restaurantId = req.params['id'];
    if (!restaurantId) {
        return res.status(400).json({ success: false, error: 'Restaurant id is required' });
    }
    const payload = updateCommissionSchema.parse(req.body);
    const restaurant = await database_1.prisma.restaurant.update({
        where: { id: restaurantId },
        data: {
            commissionRate: payload.commissionRate,
        },
        select: {
            id: true,
            name: true,
            commissionRate: true,
        },
    });
    await database_1.prisma.auditLog.create({
        data: {
            actorUserId: req.user.id,
            restaurantId,
            action: 'PLATFORM_COMMISSION_UPDATED',
            entityType: 'restaurant',
            entityId: restaurantId,
            metadata: payload,
        },
    });
    return res.json({
        success: true,
        data: { restaurant },
        message: 'Commission updated successfully',
    });
});
router.patch('/restaurants/:id/details', async (req, res) => {
    const restaurantId = req.params['id'];
    if (!restaurantId) {
        return res.status(400).json({ success: false, error: 'Restaurant id is required' });
    }
    const payload = updateRestaurantDetailsSchema.parse(req.body);
    const detailUpdateData = {
        ...(payload.gstNumber !== undefined ? { gstNumber: payload.gstNumber } : {}),
        ...(payload.bankAccountName !== undefined ? { bankAccountName: payload.bankAccountName } : {}),
        ...(payload.bankAccountNumber !== undefined ? { bankAccountNumber: payload.bankAccountNumber } : {}),
        ...(payload.bankIfsc !== undefined ? { bankIfsc: payload.bankIfsc } : {}),
        ...(payload.address !== undefined ? { address: payload.address } : {}),
        ...(payload.city !== undefined ? { city: payload.city } : {}),
        ...(payload.state !== undefined ? { state: payload.state } : {}),
        ...(payload.country !== undefined ? { country: payload.country } : {}),
    };
    const restaurant = await database_1.prisma.restaurant.update({
        where: { id: restaurantId },
        data: detailUpdateData,
        select: {
            id: true,
            name: true,
            gstNumber: true,
            bankAccountName: true,
            bankAccountNumber: true,
            bankIfsc: true,
            address: true,
            city: true,
            state: true,
            country: true,
        },
    });
    await database_1.prisma.auditLog.create({
        data: {
            actorUserId: req.user.id,
            restaurantId,
            action: 'PLATFORM_RESTAURANT_DETAILS_UPDATED',
            entityType: 'restaurant',
            entityId: restaurantId,
            metadata: payload,
        },
    });
    return res.json({
        success: true,
        data: { restaurant },
        message: 'Restaurant details updated',
    });
});
router.get('/orders', async (req, res) => {
    const restaurantId = req.query['restaurantId'];
    const orders = await database_1.prisma.order.findMany({
        where: {
            ...(restaurantId ? { restaurantId } : {}),
        },
        select: {
            id: true,
            createdAt: true,
            status: true,
            paymentStatus: true,
            totalPaise: true,
            paidAmountPaise: true,
            dueAmountPaise: true,
            restaurant: {
                select: {
                    id: true,
                    name: true,
                },
            },
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: 500,
    });
    return res.json({ success: true, data: { orders } });
});
router.get('/earnings', async (_req, res) => {
    const [totals, pendingSettlements, byRestaurant] = await Promise.all([
        database_1.prisma.earning.aggregate({
            _sum: {
                grossAmountPaise: true,
                platformCommissionPaise: true,
                restaurantEarningPaise: true,
            },
        }),
        database_1.prisma.earning.aggregate({
            where: { settled: false },
            _sum: {
                restaurantEarningPaise: true,
            },
        }),
        database_1.prisma.earning.groupBy({
            by: ['restaurantId'],
            _sum: {
                grossAmountPaise: true,
                platformCommissionPaise: true,
                restaurantEarningPaise: true,
            },
            _count: {
                _all: true,
            },
        }),
    ]);
    const restaurants = await database_1.prisma.restaurant.findMany({
        where: { id: { in: byRestaurant.map((entry) => entry.restaurantId) } },
        select: { id: true, name: true },
    });
    const restaurantNameById = new Map(restaurants.map((r) => [r.id, r.name]));
    return res.json({
        success: true,
        data: {
            totals: {
                grossAmountPaise: totals._sum.grossAmountPaise || 0,
                platformCommissionPaise: totals._sum.platformCommissionPaise || 0,
                restaurantEarningPaise: totals._sum.restaurantEarningPaise || 0,
                pendingRestaurantSettlementPaise: pendingSettlements._sum?.restaurantEarningPaise || 0,
            },
            byRestaurant: byRestaurant.map((entry) => ({
                restaurantId: entry.restaurantId,
                restaurantName: restaurantNameById.get(entry.restaurantId) || 'Unknown',
                orderCount: entry._count._all,
                grossAmountPaise: entry._sum.grossAmountPaise || 0,
                platformCommissionPaise: entry._sum.platformCommissionPaise || 0,
                restaurantEarningPaise: entry._sum.restaurantEarningPaise || 0,
            })),
        },
    });
});
exports.default = router;
//# sourceMappingURL=platform.js.map