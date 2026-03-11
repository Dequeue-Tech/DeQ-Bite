"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const restaurant_1 = require("../middleware/restaurant");
const router = (0, express_1.Router)();
const hasRestaurantStatus = !!database_1.prisma._dmmf?.modelMap?.Restaurant?.fields?.some((f) => f.name === 'status');
const restaurantFields = (database_1.prisma._dmmf?.modelMap?.Restaurant?.fields || []).map((f) => f.name);
function pickFields(fields) {
    const out = {};
    if (restaurantFields.length === 0) {
        for (const f of fields)
            out[f] = true;
        return out;
    }
    for (const f of fields) {
        if (restaurantFields.includes(f))
            out[f] = true;
    }
    return out;
}
function buildSelect(fields) {
    const out = pickFields(fields);
    return Object.keys(out).length > 0 ? out : undefined;
}
const slugify = (value) => value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
const ensureUniqueRestaurantHandles = async (name) => {
    const base = slugify(name) || 'restaurant';
    let suffix = 0;
    while (true) {
        const candidate = suffix === 0 ? base : `${base}-${suffix}`;
        const exists = await database_1.prisma.restaurant.findFirst({
            where: {
                OR: [{ slug: candidate }, { subdomain: candidate }],
            },
            select: { id: true },
        });
        if (!exists) {
            return { slug: candidate, subdomain: candidate };
        }
        suffix += 1;
    }
};
const createRestaurantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    cuisineTypes: zod_1.z.array(zod_1.z.string().min(2).max(40)).max(10).optional(),
});
const updatePaymentPolicySchema = zod_1.z.object({
    paymentCollectionTiming: zod_1.z.enum(['BEFORE_MEAL', 'AFTER_MEAL']),
    cashPaymentEnabled: zod_1.z.boolean(),
});
const addRestaurantUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    role: zod_1.z.enum(['OWNER', 'ADMIN', 'STAFF']),
});
router.get('/public/search', async (req, res) => {
    const query = req.query['query']?.trim() || '';
    const cuisine = req.query['cuisine']?.trim();
    const location = req.query['location']?.trim();
    const baseFilter = {
        active: true,
        ...(hasRestaurantStatus ? { status: 'APPROVED' } : {}),
        ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
        ...(cuisine ? { cuisineTypes: { has: cuisine } } : {}),
        ...(location
            ? {
                OR: [
                    { city: { contains: location, mode: 'insensitive' } },
                    { state: { contains: location, mode: 'insensitive' } },
                    { address: { contains: location, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    const searchSelect = buildSelect([
        'id',
        'name',
        'slug',
        'subdomain',
        'address',
        'city',
        'state',
        'cuisineTypes',
        'paymentCollectionTiming',
        'cashPaymentEnabled',
    ]);
    let restaurants;
    try {
        restaurants = await database_1.prisma.restaurant.findMany({
            where: baseFilter,
            select: searchSelect,
            orderBy: { name: 'asc' },
            take: 50,
        });
    }
    catch (err) {
        const isStatusError = err instanceof client_1.Prisma.PrismaClientValidationError ||
            (err.message && err.message.includes('Unknown argument `status`'));
        if (isStatusError) {
            console.warn('Prisma schema mismatch in search, retrying without status filter');
            const fallback = { ...baseFilter };
            delete fallback.status;
            restaurants = await database_1.prisma.restaurant.findMany({
                where: fallback,
                select: searchSelect,
                orderBy: { name: 'asc' },
                take: 50,
            });
        }
        else {
            throw err;
        }
    }
    const response = {
        success: true,
        data: {
            restaurants,
        },
    };
    res.json(response);
});
router.get('/public/:identifier', async (req, res) => {
    const identifier = req.params['identifier'];
    if (!identifier) {
        return res.status(400).json({ success: false, error: 'Restaurant identifier is required' });
    }
    const baseFilter = {
        active: true,
        ...(hasRestaurantStatus ? { status: 'APPROVED' } : {}),
        OR: [{ id: identifier }, { slug: identifier }, { subdomain: identifier }],
    };
    let restaurant;
    const detailSelect = buildSelect([
        'id',
        'name',
        'slug',
        'subdomain',
        'address',
        'city',
        'state',
        'country',
        'email',
        'phone',
        'cuisineTypes',
        'paymentCollectionTiming',
        'cashPaymentEnabled',
    ]) || {};
    detailSelect.categories = {
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
    };
    detailSelect.menuItems = {
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
    };
    try {
        restaurant = await database_1.prisma.restaurant.findFirst({
            where: baseFilter,
            select: detailSelect,
        });
    }
    catch (err) {
        const isStatusError = err instanceof client_1.Prisma.PrismaClientValidationError ||
            (err.message && err.message.includes('Unknown argument `status`'));
        if (isStatusError) {
            console.warn('Prisma schema mismatch fetching single restaurant, retrying without status filter');
            const fallback = { ...baseFilter };
            delete fallback.status;
            restaurant = await database_1.prisma.restaurant.findFirst({
                where: fallback,
                select: detailSelect,
            });
        }
        else {
            throw err;
        }
    }
    if (!restaurant) {
        return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }
    return res.json({
        success: true,
        data: {
            restaurant,
        },
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
    const mineSelect = buildSelect([
        'id',
        'name',
        'slug',
        'subdomain',
        'paymentCollectionTiming',
        'cashPaymentEnabled',
    ]);
    if (hasRestaurantStatus) {
        mineSelect.status = true;
    }
    const restaurants = await database_1.prisma.restaurantUser.findMany({
        where: {
            userId: req.user.id,
            active: true,
        },
        include: {
            restaurant: {
                select: mineSelect,
            },
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
                status: entry.restaurant.status,
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
    const handles = await ensureUniqueRestaurantHandles(payload.name);
    const createSelect = buildSelect([
        'id',
        'name',
        'slug',
        'subdomain',
        'address',
        'email',
        'phone',
        'active',
        'paymentCollectionTiming',
        'cashPaymentEnabled',
        'createdAt',
        'updatedAt',
    ]);
    if (hasRestaurantStatus)
        createSelect.status = true;
    const restaurant = await database_1.prisma.restaurant.create({
        data: {
            name: payload.name,
            slug: handles.slug,
            subdomain: handles.subdomain,
            email: payload.email ?? null,
            phone: payload.phone ?? null,
            address: payload.address ?? null,
            city: payload.city ?? null,
            state: payload.state ?? null,
            country: payload.country ?? null,
            cuisineTypes: payload.cuisineTypes ?? [],
            active: true,
            ...(hasRestaurantStatus ? { status: 'APPROVED' } : {}),
            approvedAt: new Date(),
            approvedByUserId: req.user.id,
        },
        select: createSelect,
    });
    await database_1.prisma.restaurantUser.create({
        data: {
            restaurantId: restaurant.id,
            userId: req.user.id,
            role: 'OWNER',
        },
    });
    await database_1.prisma.auditLog.create({
        data: {
            actorUserId: req.user.id,
            restaurantId: restaurant.id,
            action: 'RESTAURANT_CREATED',
            entityType: 'restaurant',
            entityId: restaurant.id,
            metadata: {
                slug: restaurant.slug,
                subdomain: restaurant.subdomain,
            },
        },
    });
    const response = {
        success: true,
        data: { restaurant },
        message: 'Restaurant onboarded successfully',
    };
    res.status(201).json(response);
});
router.get('/settings/payment-policy', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    const policySelect = buildSelect([
        'id',
        'name',
        'paymentCollectionTiming',
        'cashPaymentEnabled',
    ]);
    const restaurant = await database_1.prisma.restaurant.findUnique({
        where: { id: req.restaurant.id },
        select: policySelect,
    });
    return res.json({
        success: true,
        data: { paymentPolicy: restaurant },
    });
});
router.put('/settings/payment-policy', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    const payload = updatePaymentPolicySchema.parse(req.body);
    const policySelect = buildSelect([
        'id',
        'name',
        'paymentCollectionTiming',
        'cashPaymentEnabled',
    ]);
    const restaurant = await database_1.prisma.restaurant.update({
        where: { id: req.restaurant.id },
        data: {
            paymentCollectionTiming: payload.paymentCollectionTiming,
            cashPaymentEnabled: payload.cashPaymentEnabled,
        },
        select: policySelect,
    });
    await database_1.prisma.auditLog.create({
        data: {
            actorUserId: req.user.id,
            restaurantId: req.restaurant.id,
            action: 'PAYMENT_POLICY_UPDATED',
            entityType: 'restaurant',
            entityId: req.restaurant.id,
            metadata: payload,
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
    await database_1.prisma.auditLog.create({
        data: {
            actorUserId: req.user.id,
            restaurantId: req.restaurant.id,
            action: 'RESTAURANT_USER_UPSERT',
            entityType: 'restaurant_user',
            entityId: membership.id,
            metadata: {
                userId: membership.userId,
                role: membership.role,
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