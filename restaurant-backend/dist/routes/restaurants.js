"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const restaurant_1 = require("../middleware/restaurant");
const router = (0, express_1.Router)();
const createRestaurantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
});
const updatePaymentPolicySchema = zod_1.z.object({
    paymentCollectionTiming: zod_1.z.enum(['BEFORE_MEAL', 'AFTER_MEAL']),
    cashPaymentEnabled: zod_1.z.boolean(),
});
const addRestaurantUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    role: zod_1.z.enum(['OWNER', 'ADMIN', 'STAFF']),
});
const slugify = (value) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
const generateRestaurantKeys = async (name) => {
    const base = slugify(name) || 'restaurant';
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const suffix = attempt === 0 ? '' : `-${Math.random().toString(36).slice(2, 6)}`;
        const candidate = `${base}${suffix}`.slice(0, 60);
        const existing = await database_1.prisma.restaurant.findFirst({
            where: {
                OR: [{ slug: candidate }, { subdomain: candidate }],
            },
            select: { id: true },
        });
        if (!existing) {
            return { slug: candidate, subdomain: candidate };
        }
    }
    throw new Error('Unable to generate unique restaurant key');
};
router.get('/public/search', async (req, res) => {
    const query = req.query['query']?.trim() || '';
    const restaurants = await database_1.prisma.restaurant.findMany({
        where: {
            active: true,
            ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
        },
        select: {
            id: true,
            name: true,
            subdomain: true,
            address: true,
            paymentCollectionTiming: true,
            cashPaymentEnabled: true,
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
router.get('/public/:id', async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ success: false, error: 'Restaurant id is required' });
    }
    const restaurant = await database_1.prisma.restaurant.findFirst({
        where: { id, active: true },
        select: {
            id: true,
            name: true,
            subdomain: true,
            address: true,
            email: true,
            phone: true,
            paymentCollectionTiming: true,
            cashPaymentEnabled: true,
            categories: {
                where: { active: true },
                orderBy: { sortOrder: 'asc' },
                select: { id: true, name: true },
            },
            menuItems: {
                where: { available: true },
                take: 12,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    pricePaise: true,
                    isVeg: true,
                    category: { select: { id: true, name: true } },
                },
            },
        },
    });
    if (!restaurant) {
        return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }
    return res.json({
        success: true,
        data: { restaurant },
    });
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
                subdomain: entry.restaurant.subdomain,
                role: entry.role,
                paymentCollectionTiming: entry.restaurant.paymentCollectionTiming,
                cashPaymentEnabled: entry.restaurant.cashPaymentEnabled,
            })),
        },
    };
    res.json(response);
});
router.post('/', auth_1.authenticate, async (req, res) => {
    const payload = createRestaurantSchema.parse(req.body);
    const keys = await generateRestaurantKeys(payload.name);
    const restaurant = await database_1.prisma.$transaction(async (tx) => {
        const created = await tx.restaurant.create({
            data: {
                name: payload.name,
                slug: keys.slug,
                subdomain: keys.subdomain,
                email: payload.email ?? null,
                phone: payload.phone ?? null,
                address: payload.address ?? null,
                paymentCollectionTiming: 'AFTER_MEAL',
                cashPaymentEnabled: true,
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
});
router.get('/settings/payment-policy', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    const restaurant = await database_1.prisma.restaurant.findUnique({
        where: { id: req.restaurant.id },
        select: {
            id: true,
            name: true,
            paymentCollectionTiming: true,
            cashPaymentEnabled: true,
        },
    });
    return res.json({
        success: true,
        data: { paymentPolicy: restaurant },
    });
});
router.put('/settings/payment-policy', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    const payload = updatePaymentPolicySchema.parse(req.body);
    const restaurant = await database_1.prisma.restaurant.update({
        where: { id: req.restaurant.id },
        data: {
            paymentCollectionTiming: payload.paymentCollectionTiming,
            cashPaymentEnabled: payload.cashPaymentEnabled,
        },
        select: {
            id: true,
            name: true,
            paymentCollectionTiming: true,
            cashPaymentEnabled: true,
        },
    });
    return res.json({
        success: true,
        message: 'Payment policy updated',
        data: { paymentPolicy: restaurant },
    });
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