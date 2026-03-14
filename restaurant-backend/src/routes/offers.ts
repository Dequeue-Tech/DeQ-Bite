import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';
import { safeCreateAuditLog } from '@/utils/audit';
import { accelerateCache } from '@/utils/accelerate-cache';

const router = Router();

const offerSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(400).optional(),
  code: z.string().min(3).max(30).optional(),
  discountType: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().positive(),
  minOrderPaise: z.number().int().positive().optional(),
  maxDiscountPaise: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

const offerUpdateSchema = offerSchema.partial();

const normalizeCode = (code?: string) => (code ? code.trim().toUpperCase() : undefined);

router.get('/', requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const take = typeof req.query.take !== 'undefined' ? Math.min(Number(req.query.take) || 0, 200) : undefined;
  const cursor = req.query.cursor ? { id: String(req.query.cursor) } : undefined;

  const offers = await prisma.offer.findMany({
    where: {
      restaurantId: req.restaurant!.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    ...(typeof take === 'number' ? { take } : {}),
    ...(cursor ? { cursor, skip: 1 } : {}),
    ...(accelerateCache(60, 120) as any),
  });

  return res.json({
    success: true,
    data: { offers },
  });
});

router.post('/', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  const payload = offerSchema.parse(req.body);

  const offer = await prisma.offer.create({
    data: {
      restaurantId: req.restaurant!.id,
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

  await safeCreateAuditLog({
    actorUserId: req.user!.id,
    restaurantId: req.restaurant!.id,
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

router.put('/:id', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  const id = req.params['id'];
  if (!id) {
    return res.status(400).json({ success: false, error: 'Offer id is required' });
  }

  const payload = offerUpdateSchema.parse(req.body);

  const existing = await prisma.offer.findFirst({
    where: {
      id,
      restaurantId: req.restaurant!.id,
    },
  });

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Offer not found' });
  }

  const offer = await prisma.offer.update({
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

  await safeCreateAuditLog({
    actorUserId: req.user!.id,
    restaurantId: req.restaurant!.id,
    action: 'OFFER_UPDATED',
    entityType: 'offer',
    entityId: offer.id,
    metadata: payload,
  });

  return res.json({ success: true, data: { offer }, message: 'Offer updated' });
});

router.delete('/:id', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  const id = req.params['id'];
  if (!id) {
    return res.status(400).json({ success: false, error: 'Offer id is required' });
  }

  const existing = await prisma.offer.findFirst({
    where: {
      id,
      restaurantId: req.restaurant!.id,
    },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Offer not found' });
  }

  await prisma.offer.delete({ where: { id } });

  await safeCreateAuditLog({
    actorUserId: req.user!.id,
    restaurantId: req.restaurant!.id,
    action: 'OFFER_DELETED',
    entityType: 'offer',
    entityId: id,
  });

  return res.json({ success: true, message: 'Offer deleted' });
});

export default router;
