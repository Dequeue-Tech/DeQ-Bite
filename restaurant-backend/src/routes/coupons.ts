import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest, ApiResponse } from '@/types/api';

const router = Router();

const TAX_RATE = 0.08;

const createCouponSchema = z.object({
  code: z.string().min(3).max(30),
  description: z.string().optional(),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().positive(),
  maxDiscountPaise: z.number().int().positive().optional(),
  minOrderPaise: z.number().int().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  active: z.boolean().optional(),
});

const updateCouponSchema = createCouponSchema.partial();

const validateCouponSchema = z.object({
  code: z.string().min(3).max(30),
  subtotalPaise: z.number().int().nonnegative(),
});

const normalizeCode = (code: string) => code.trim().toUpperCase();

const computeDiscountPaise = (coupon: any, subtotalPaise: number) => {
  let discountPaise = 0;
  if (coupon.type === 'PERCENT') {
    discountPaise = Math.floor((subtotalPaise * coupon.value) / 100);
  } else {
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

// GET /api/coupons - list coupons (admin/owner)
router.get('/', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  const coupons = await prisma.coupon.findMany({
    where: { restaurantId: req.restaurant!.id },
    orderBy: { createdAt: 'desc' },
  });

  const response: ApiResponse = {
    success: true,
    data: { coupons },
  };
  res.json(response);
});

// POST /api/coupons - create coupon (admin/owner)
router.post('/', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  const payload = createCouponSchema.parse(req.body);
  const code = normalizeCode(payload.code);

  const coupon = await prisma.coupon.create({
    data: {
      ...payload,
      code,
      restaurantId: req.restaurant!.id,
      startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
    },
  });

  const response: ApiResponse = {
    success: true,
    data: { coupon },
    message: 'Coupon created',
  };
  res.status(201).json(response);
});

// PUT /api/coupons/:id - update coupon
router.put('/:id', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const payload = updateCouponSchema.parse(req.body);

  const existing = await prisma.coupon.findFirst({
    where: { id, restaurantId: req.restaurant!.id },
  });

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Coupon not found' });
  }

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      ...payload,
      code: payload.code ? normalizeCode(payload.code) : undefined,
      startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : undefined,
    },
  });

  const response: ApiResponse = {
    success: true,
    data: { coupon },
    message: 'Coupon updated',
  };
  res.json(response);
});

// POST /api/coupons/validate - validate coupon for current restaurant
router.post('/validate', requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const { code, subtotalPaise } = validateCouponSchema.parse(req.body);
  const normalized = normalizeCode(code);

  const coupon = await prisma.coupon.findFirst({
    where: {
      restaurantId: req.restaurant!.id,
      code: normalized,
      active: true,
    },
  });

  if (!coupon) {
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

  const response: ApiResponse = {
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

  res.json(response);
});

export default router;
