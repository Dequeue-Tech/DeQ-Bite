"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("@/config/database");
const auth_1 = require("@/middleware/auth");
const restaurant_1 = require("@/middleware/restaurant");
const accelerate_cache_1 = require("@/utils/accelerate-cache");
const cache_1 = require("@/middleware/cache");
const cache_2 = require("@/utils/cache");
const router = (0, express_1.Router)();
const TAX_RATE = 0.08;
const createCouponSchema = zod_1.z.object({
    code: zod_1.z.string().min(3).max(30),
    description: zod_1.z.string().optional(),
    type: zod_1.z.enum(['PERCENT', 'FIXED']),
    value: zod_1.z.number().int().positive(),
    maxDiscountPaise: zod_1.z.number().int().positive().optional(),
    minOrderPaise: zod_1.z.number().int().positive().optional(),
    usageLimit: zod_1.z.number().int().positive().optional(),
    startsAt: zod_1.z.string().datetime().optional(),
    endsAt: zod_1.z.string().datetime().optional(),
    active: zod_1.z.boolean().optional(),
});
const updateCouponSchema = createCouponSchema.partial();
const validateCouponSchema = zod_1.z.object({
    code: zod_1.z.string().min(3).max(30),
    subtotalPaise: zod_1.z.number().int().nonnegative(),
});
const normalizeCode = (code) => code.trim().toUpperCase();
const computeDiscountPaise = (coupon, subtotalPaise) => {
    let discountPaise = 0;
    if (coupon.type === 'PERCENT') {
        discountPaise = Math.floor((subtotalPaise * coupon.value) / 100);
    }
    else {
        discountPaise = coupon.value;
    }
    if (coupon.maxDiscountPaise && discountPaise > coupon.maxDiscountPaise) {
        discountPaise = coupon.maxDiscountPaise;
    }
    if (discountPaise > subtotalPaise) {
        discountPaise = subtotalPaise;
    }
    return discountPaise;
};
router.get('/', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'), (0, cache_1.cacheResponse)(120, 'coupons:list'), async (req, res) => {
    const take = typeof req.query.take !== 'undefined' ? Math.min(Number(req.query.take) || 0, 200) : undefined;
    const cursor = req.query.cursor ? { id: String(req.query.cursor) } : undefined;
    const coupons = await database_1.prisma.coupon.findMany({
        where: { restaurantId: req.restaurant.id },
        orderBy: { createdAt: 'desc' },
        ...(typeof take === 'number' ? { take } : {}),
        ...(cursor ? { cursor, skip: 1 } : {}),
        ...(0, accelerate_cache_1.accelerateCache)(60, 120),
    });
    const response = {
        success: true,
        data: { coupons },
    };
    res.json(response);
});
router.post('/', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    try {
        const payload = createCouponSchema.parse(req.body);
        const code = normalizeCode(payload.code);
        const startsAt = payload.startsAt ? new Date(payload.startsAt) : null;
        const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
        const data = {
            code,
            restaurantId: req.restaurant.id,
            type: payload.type,
            value: payload.value,
            startsAt,
            endsAt,
            ...(payload.description !== undefined ? { description: payload.description } : {}),
            ...(payload.maxDiscountPaise !== undefined ? { maxDiscountPaise: payload.maxDiscountPaise } : {}),
            ...(payload.minOrderPaise !== undefined ? { minOrderPaise: payload.minOrderPaise } : {}),
            ...(payload.usageLimit !== undefined ? { usageLimit: payload.usageLimit } : {}),
            ...(payload.active !== undefined ? { active: payload.active } : {}),
        };
        const coupon = await database_1.prisma.coupon.create({
            data,
        });
        const response = {
            success: true,
            data: { coupon },
            message: 'Coupon created',
        };
        return res.status(201).json(response);
    }
    finally {
        if (req.restaurant?.id) {
            await (0, cache_2.invalidateCacheByPrefix)('coupons:list', req.restaurant.id);
        }
    }
});
router.put('/:id', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Coupon ID is required' });
        }
        const payload = updateCouponSchema.parse(req.body);
        const existing = await database_1.prisma.coupon.findFirst({
            where: { id, restaurantId: req.restaurant.id },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Coupon not found' });
        }
        const data = {
            ...(payload.code !== undefined ? { code: normalizeCode(payload.code) } : {}),
            ...(payload.startsAt !== undefined ? { startsAt: new Date(payload.startsAt) } : {}),
            ...(payload.endsAt !== undefined ? { endsAt: new Date(payload.endsAt) } : {}),
            ...(payload.description !== undefined ? { description: payload.description } : {}),
            ...(payload.type !== undefined ? { type: payload.type } : {}),
            ...(payload.value !== undefined ? { value: payload.value } : {}),
            ...(payload.maxDiscountPaise !== undefined ? { maxDiscountPaise: payload.maxDiscountPaise } : {}),
            ...(payload.minOrderPaise !== undefined ? { minOrderPaise: payload.minOrderPaise } : {}),
            ...(payload.usageLimit !== undefined ? { usageLimit: payload.usageLimit } : {}),
            ...(payload.active !== undefined ? { active: payload.active } : {}),
        };
        const coupon = await database_1.prisma.coupon.update({
            where: { id },
            data,
        });
        const response = {
            success: true,
            data: { coupon },
            message: 'Coupon updated',
        };
        return res.json(response);
    }
    finally {
        if (req.restaurant?.id) {
            await (0, cache_2.invalidateCacheByPrefix)('coupons:list', req.restaurant.id);
        }
    }
});
router.post('/validate', restaurant_1.requireRestaurant, async (req, res) => {
    const { code, subtotalPaise } = validateCouponSchema.parse(req.body);
    const normalized = normalizeCode(code);
    const coupon = await database_1.prisma.coupon.findUnique({
        where: {
            restaurantId_code: {
                restaurantId: req.restaurant.id,
                code: normalized,
            },
        },
    });
    if (!coupon || !coupon.active) {
        return res.status(404).json({ success: false, error: 'Invalid or inactive coupon' });
    }
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
        return res.status(400).json({ success: false, error: 'Coupon is not active yet' });
    }
    if (coupon.endsAt && coupon.endsAt < now) {
        return res.status(400).json({ success: false, error: 'Coupon has expired' });
    }
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return res.status(400).json({ success: false, error: 'Coupon usage limit reached' });
    }
    if (coupon.minOrderPaise && subtotalPaise < coupon.minOrderPaise) {
        return res.status(400).json({ success: false, error: 'Order total does not meet coupon minimum' });
    }
    const discountPaise = computeDiscountPaise(coupon, subtotalPaise);
    const taxablePaise = Math.max(subtotalPaise - discountPaise, 0);
    const taxPaise = Math.round(taxablePaise * TAX_RATE);
    const totalPaise = taxablePaise + taxPaise;
    const response = {
        success: true,
        data: {
            coupon: {
                id: coupon.id,
                code: coupon.code,
                type: coupon.type,
                value: coupon.value,
            },
            discountPaise,
            taxPaise,
            totalPaise,
        },
    };
    return res.json(response);
});
exports.default = router;
//# sourceMappingURL=coupons.js.map