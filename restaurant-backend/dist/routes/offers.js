"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const restaurant_1 = require("../middleware/restaurant");
const audit_1 = require("../utils/audit");
const router = (0, express_1.Router)();
const offerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    description: zod_1.z.string().max(400).optional(),
    code: zod_1.z.string().min(3).max(30).optional(),
    discountType: zod_1.z.enum(['PERCENT', 'FIXED']),
    value: zod_1.z.number().int().positive(),
    minOrderPaise: zod_1.z.number().int().positive().optional(),
    maxDiscountPaise: zod_1.z.number().int().positive().optional(),
    startsAt: zod_1.z.string().datetime().optional(),
    endsAt: zod_1.z.string().datetime().optional(),
    active: zod_1.z.boolean().optional(),
});
const offerUpdateSchema = offerSchema.partial();
const normalizeCode = (code) => (code ? code.trim().toUpperCase() : undefined);
router.get('/', restaurant_1.requireRestaurant, async (req, res) => {
    const offers = await database_1.prisma.offer.findMany({
        where: {
            restaurantId: req.restaurant.id,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    return res.json({
        success: true,
        data: { offers },
    });
});
router.post('/', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    const payload = offerSchema.parse(req.body);
    const offer = await database_1.prisma.offer.create({
        data: {
            restaurantId: req.restaurant.id,
            name: payload.name,
            description: payload.description ?? null,
            code: normalizeCode(payload.code) ?? null,
            discountType: payload.discountType,
            value: payload.value,
            minOrderPaise: payload.minOrderPaise ?? null,
            maxDiscountPaise: payload.maxDiscountPaise ?? null,
            startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
            endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
            active: payload.active ?? true,
        },
    });
    await (0, audit_1.safeCreateAuditLog)({
        actorUserId: req.user.id,
        restaurantId: req.restaurant.id,
        action: 'OFFER_CREATED',
        entityType: 'offer',
        entityId: offer.id,
        metadata: {
            name: offer.name,
            code: offer.code,
        },
    });
    return res.status(201).json({ success: true, data: { offer }, message: 'Offer created' });
});
router.put('/:id', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    const id = req.params['id'];
    if (!id) {
        return res.status(400).json({ success: false, error: 'Offer id is required' });
    }
    const payload = offerUpdateSchema.parse(req.body);
    const existing = await database_1.prisma.offer.findFirst({
        where: {
            id,
            restaurantId: req.restaurant.id,
        },
    });
    if (!existing) {
        return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    const offer = await database_1.prisma.offer.update({
        where: { id },
        data: {
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.description !== undefined ? { description: payload.description } : {}),
            ...(payload.code !== undefined ? { code: normalizeCode(payload.code) ?? null } : {}),
            ...(payload.discountType !== undefined ? { discountType: payload.discountType } : {}),
            ...(payload.value !== undefined ? { value: payload.value } : {}),
            ...(payload.minOrderPaise !== undefined ? { minOrderPaise: payload.minOrderPaise ?? null } : {}),
            ...(payload.maxDiscountPaise !== undefined ? { maxDiscountPaise: payload.maxDiscountPaise ?? null } : {}),
            ...(payload.startsAt !== undefined ? { startsAt: payload.startsAt ? new Date(payload.startsAt) : null } : {}),
            ...(payload.endsAt !== undefined ? { endsAt: payload.endsAt ? new Date(payload.endsAt) : null } : {}),
            ...(payload.active !== undefined ? { active: payload.active } : {}),
        },
    });
    await (0, audit_1.safeCreateAuditLog)({
        actorUserId: req.user.id,
        restaurantId: req.restaurant.id,
        action: 'OFFER_UPDATED',
        entityType: 'offer',
        entityId: offer.id,
        metadata: payload,
    });
    return res.json({ success: true, data: { offer }, message: 'Offer updated' });
});
router.delete('/:id', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), async (req, res) => {
    const id = req.params['id'];
    if (!id) {
        return res.status(400).json({ success: false, error: 'Offer id is required' });
    }
    const existing = await database_1.prisma.offer.findFirst({
        where: {
            id,
            restaurantId: req.restaurant.id,
        },
        select: { id: true },
    });
    if (!existing) {
        return res.status(404).json({ success: false, error: 'Offer not found' });
    }
    await database_1.prisma.offer.delete({ where: { id } });
    await (0, audit_1.safeCreateAuditLog)({
        actorUserId: req.user.id,
        restaurantId: req.restaurant.id,
        action: 'OFFER_DELETED',
        entityType: 'offer',
        entityId: id,
    });
    return res.json({ success: true, message: 'Offer deleted' });
});
exports.default = router;
//# sourceMappingURL=offers.js.map