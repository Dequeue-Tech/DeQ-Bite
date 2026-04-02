"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("@/config/database");
const auth_1 = require("@/middleware/auth");
const errorHandler_1 = require("@/middleware/errorHandler");
const router = (0, express_1.Router)();
const firebaseSessionSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters').max(50).optional(),
    phone: zod_1.z.string().min(10, 'Phone number must be at least 10 digits').optional(),
});
router.post('/register', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const response = {
        success: false,
        message: 'This endpoint is deprecated. Use Firebase Authentication on the client, then call /api/auth/session with a Firebase ID token.',
    };
    res.status(410).json(response);
}));
router.post('/login', (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const response = {
        success: false,
        message: 'This endpoint is deprecated. Use Firebase Authentication on the client, then call /api/auth/session with a Firebase ID token.',
    };
    res.status(410).json(response);
}));
router.post('/session', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const payload = firebaseSessionSchema.parse(req.body ?? {});
    const userId = req.user.id;
    if (payload.phone) {
        const phoneOwner = await database_1.prisma.user.findFirst({
            where: {
                phone: payload.phone,
                NOT: { id: userId },
            },
            select: { id: true },
        });
        if (phoneOwner) {
            throw new errorHandler_1.AppError('Phone number is already in use by another account', 409);
        }
    }
    const user = await database_1.prisma.user.update({
        where: { id: userId },
        data: {
            ...(payload.name ? { name: payload.name } : {}),
            ...(payload.phone ? { phone: payload.phone } : {}),
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            verified: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    const response = {
        success: true,
        message: 'Session synchronized successfully',
        data: { user },
    };
    res.json(response);
}));
router.get('/me', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = await database_1.prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            verified: true,
            createdAt: true,
            updatedAt: true,
            orders: {
                take: 10,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    status: true,
                    totalPaise: true,
                    createdAt: true,
                    table: {
                        select: {
                            number: true,
                            location: true,
                        },
                    },
                },
            },
            _count: {
                select: {
                    orders: true,
                },
            },
        },
    });
    if (!user) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    let restaurantRole = null;
    if (req.restaurant) {
        const membership = await database_1.prisma.restaurantUser.findUnique({
            where: {
                restaurantId_userId: {
                    restaurantId: req.restaurant.id,
                    userId: req.user.id,
                },
            },
            select: { role: true, active: true },
        });
        if (membership?.active) {
            restaurantRole = membership.role;
        }
    }
    const response = {
        success: true,
        data: {
            user: {
                ...user,
                totalOrders: user._count.orders,
                recentOrders: user.orders,
                restaurantRole,
            },
        },
    };
    res.json(response);
}));
router.get('/profile', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userProfile = await database_1.prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            verified: true,
            createdAt: true,
            updatedAt: true,
            orders: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    status: true,
                    paymentStatus: true,
                    totalPaise: true,
                    createdAt: true,
                    table: {
                        select: {
                            number: true,
                            location: true,
                        },
                    },
                    items: {
                        select: {
                            quantity: true,
                            pricePaise: true,
                            menuItem: {
                                select: {
                                    name: true,
                                    category: {
                                        select: {
                                            name: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            _count: {
                select: {
                    orders: true,
                },
            },
        },
    });
    if (!userProfile) {
        throw new errorHandler_1.AppError('User profile not found', 404);
    }
    let restaurantRole = null;
    if (req.restaurant) {
        const membership = await database_1.prisma.restaurantUser.findUnique({
            where: {
                restaurantId_userId: {
                    restaurantId: req.restaurant.id,
                    userId: req.user.id,
                },
            },
            select: { role: true, active: true },
        });
        if (membership?.active) {
            restaurantRole = membership.role;
        }
    }
    const totalSpent = await database_1.prisma.order.aggregate({
        where: {
            userId: req.user.id,
            paymentStatus: 'COMPLETED',
        },
        _sum: {
            totalPaise: true,
        },
    });
    const response = {
        success: true,
        data: {
            user: {
                ...userProfile,
                totalOrders: userProfile._count.orders,
                totalSpent: totalSpent._sum.totalPaise || 0,
                recentOrders: userProfile.orders,
                restaurantRole,
            },
        },
    };
    res.json(response);
}));
router.put('/change-password', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const response = {
        success: false,
        message: 'Password changes are managed by Firebase Authentication. Use Firebase reset/update flows on the client.',
    };
    res.status(410).json(response);
}));
router.post('/refresh', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const response = {
        success: false,
        message: 'Token refresh is managed by Firebase Authentication. Fetch a fresh Firebase ID token on the client.',
    };
    res.status(410).json(response);
}));
exports.default = router;
//# sourceMappingURL=auth.js.map