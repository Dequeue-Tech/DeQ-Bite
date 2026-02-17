"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters').max(50),
    email: zod_1.z.string().email('Invalid email address'),
    phone: zod_1.z.string().min(10, 'Phone number must be at least 10 digits').optional(),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z.string().min(6, 'New password must be at least 6 characters'),
});
const generateToken = (userId) => {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new errorHandler_1.AppError('JWT_SECRET environment variable is not configured', 500);
    }
    const payload = { id: userId };
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    return jsonwebtoken_1.default.sign(payload, jwtSecret, {
        expiresIn,
    });
};
router.post('/register', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, phone, password } = registerSchema.parse(req.body);
    const existingUser = await database_1.prisma.user.findFirst({
        where: {
            OR: [
                { email },
                ...(phone ? [{ phone }] : []),
            ],
        },
    });
    if (existingUser) {
        throw new errorHandler_1.AppError('User with this email or phone already exists', 409);
    }
    const saltRounds = 12;
    const hashedPassword = await bcryptjs_1.default.hash(password, saltRounds);
    const user = await database_1.prisma.user.create({
        data: {
            name,
            email,
            phone: phone || null,
            password: hashedPassword,
            role: 'CUSTOMER',
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            verified: true,
            createdAt: true,
        },
    });
    const token = generateToken(user.id);
    const response = {
        success: true,
        message: 'User registered successfully',
        data: {
            user,
            token,
        },
    };
    res.status(201).json(response);
}));
router.post('/login', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await database_1.prisma.user.findUnique({
        where: { email },
        include: {
            orders: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    status: true,
                    totalPaise: true,
                    createdAt: true,
                },
            },
        },
    });
    if (!user) {
        throw new errorHandler_1.AppError('Invalid email or password', 401);
    }
    const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
    if (!isPasswordValid) {
        throw new errorHandler_1.AppError('Invalid email or password', 401);
    }
    const token = generateToken(user.id);
    const response = {
        success: true,
        message: 'Login successful',
        data: {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                verified: user.verified,
                createdAt: user.createdAt,
                recentOrders: user.orders,
            },
            token,
        },
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
router.put('/change-password', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await database_1.prisma.user.findUnique({
        where: { id: req.user.id },
    });
    if (!user) {
        throw new errorHandler_1.AppError('User not found', 404);
    }
    const isCurrentPasswordValid = await bcryptjs_1.default.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
        throw new errorHandler_1.AppError('Current password is incorrect', 400);
    }
    const saltRounds = 12;
    const hashedNewPassword = await bcryptjs_1.default.hash(newPassword, saltRounds);
    await database_1.prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedNewPassword },
    });
    const response = {
        success: true,
        message: 'Password changed successfully',
    };
    res.json(response);
}));
router.post('/refresh', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const token = generateToken(req.user.id);
    const response = {
        success: true,
        message: 'Token refreshed successfully',
        data: { token },
    };
    res.json(response);
}));
exports.default = router;
//# sourceMappingURL=auth.js.map