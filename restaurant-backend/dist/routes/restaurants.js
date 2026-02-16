"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("@/config/database");
const auth_1 = require("@/middleware/auth");
const restaurant_1 = require("@/middleware/restaurant");
const router = (0, express_1.Router)();
const createRestaurantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    slug: zod_1.z.string().min(2).max(60),
    subdomain: zod_1.z.string().min(2).max(60),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
});
const addRestaurantUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    role: zod_1.z.enum(['OWNER', 'ADMIN', 'STAFF']),
});
router.get('/public/search', async (req, res) => {
    const query = req.query['query']?.trim() || '';
    const restaurants = await database_1.prisma.restaurant.findMany({
        where: {
            active: true,
            ...(query
                ? {
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { slug: { contains: query, mode: 'insensitive' } },
                    ],
                }
                : {}),
        },
        select: {
            id: true,
            name: true,
            slug: true,
            subdomain: true,
            address: true,
        },
        orderBy: { name: 'asc' },
        take: 50,
    });
    const response = {
        success: true,
        data: { restaurants },
    };
    res.json(response);
});
router.get('/current', restaurant_1.requireRestaurant, async (req, res) => {
    const response = {
        success: true,
        data: { restaurant: req.restaurant },
    };
    res.json(response);
});
router.get('/mine', auth_1.authenticate, async (req, res) => {
    const restaurants = await database_1.prisma.restaurantUser.findMany({
        where: {
            userId: req.user.id,
            active: true,
        },
        include: {
            restaurant: true,
        },
    });
    const response = {
        success: true,
        data: {
            restaurants: restaurants.map((entry) => ({
                id: entry.restaurant.id,
                name: entry.restaurant.name,
                slug: entry.restaurant.slug,
                subdomain: entry.restaurant.subdomain,
                role: entry.role,
            })),
        },
    };
    res.json(response);
});
router.post('/', auth_1.authenticate, async (req, res) => {
    const payload = createRestaurantSchema.parse(req.body);
    const slug = payload.slug.trim().toLowerCase();
    const subdomain = payload.subdomain.trim().toLowerCase();
    const existing = await database_1.prisma.restaurant.findFirst({
        where: {
            OR: [{ slug }, { subdomain }],
        },
    });
    if (existing) {
        res.status(409).json({
            success: false,
            error: 'Restaurant with this slug or subdomain already exists',
        });
        return;
    }
    const restaurant = await database_1.prisma.$transaction(async (tx) => {
        const created = await tx.restaurant.create({
            data: {
                name: payload.name,
                slug,
                subdomain,
                email: payload.email ?? null,
                phone: payload.phone ?? null,
                address: payload.address ?? null,
            },
        });
        await tx.restaurantUser.create({
            data: {
                restaurantId: created.id,
                userId: req.user.id,
                role: 'OWNER',
            },
        });
        return created;
    });
    const response = {
        success: true,
        data: { restaurant },
        message: 'Restaurant created',
    };
    res.status(201).json(response);
    return;
});
router.get('/users', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    const users = await database_1.prisma.restaurantUser.findMany({
        where: {
            restaurantId: req.restaurant.id,
            active: true,
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    role: true,
                    createdAt: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    const response = {
        success: true,
        data: {
            users: users.map((entry) => ({
                membershipId: entry.id,
                role: entry.role,
                active: entry.active,
                user: entry.user,
            })),
        },
    };
    res.json(response);
});
router.post('/users', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    const payload = addRestaurantUserSchema.parse(req.body);
    const user = await database_1.prisma.user.findUnique({
        where: { email: payload.email },
        select: { id: true },
    });
    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found. Ask them to sign up first.',
        });
    }
    const membership = await database_1.prisma.restaurantUser.upsert({
        where: {
            restaurantId_userId: {
                restaurantId: req.restaurant.id,
                userId: user.id,
            },
        },
        update: {
            role: payload.role,
            active: true,
        },
        create: {
            restaurantId: req.restaurant.id,
            userId: user.id,
            role: payload.role,
            active: true,
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
    });
    return res.status(201).json({
        success: true,
        data: {
            membership: {
                id: membership.id,
                role: membership.role,
                active: membership.active,
                user: membership.user,
            },
        },
        message: 'Restaurant user added/updated successfully',
    });
});
exports.default = router;
//# sourceMappingURL=restaurants.js.map