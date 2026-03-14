import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate, authorize } from '@/middleware/auth';
import { AuthenticatedRequest } from '@/types/api';
import { safeCreateAuditLog } from '@/utils/audit';
import { accelerateCache } from '@/utils/accelerate-cache';

const router = Router();

const updateRestaurantStatusSchema = z.object({
  status: z.enum(['APPROVED', 'SUSPENDED']),
  suspendedReason: z.string().max(500).optional(),
});

const updateCommissionSchema = z.object({
  commissionRate: z.number().min(0).max(100),
});

const updateRestaurantDetailsSchema = z.object({
  gstNumber: z.string().max(40).optional(),
  bankAccountName: z.string().max(120).optional(),
  bankAccountNumber: z.string().max(40).optional(),
  bankIfsc: z.string().max(20).optional(),
  address: z.string().max(250).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
});

router.use(authenticate);
router.use(authorize('OWNER'));

// GET /api/platform/restaurants
router.get('/restaurants', async (req: AuthenticatedRequest, res: Response) => {
  const status = req.query['status'] as string | undefined;

  const take = typeof req.query.take !== 'undefined' ? Math.min(Number(req.query.take) || 0, 200) : undefined;
  const cursor = req.query.cursor ? { id: String(req.query.cursor) } : undefined;

  const restaurants = await prisma.restaurant.findMany({
    where: status && ['PENDING_APPROVAL', 'APPROVED', 'SUSPENDED'].includes(status)
      ? ({ status } as any)
      : undefined,
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
    } as any,
    orderBy: {
      createdAt: 'desc',
    },
    ...(typeof take === 'number' ? { take } : {}),
    ...(cursor ? { cursor, skip: 1 } : {}),
    ...(accelerateCache(60, 120) as any),
  });

  return res.json({
    success: true,
    data: { restaurants },
  });
});

// PATCH /api/platform/restaurants/:id/status
router.patch('/restaurants/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.params['id'];
  if (!restaurantId) {
    return res.status(400).json({ success: false, error: 'Restaurant id is required' });
  }

  const payload = updateRestaurantStatusSchema.parse(req.body);

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      status: payload.status,
      active: payload.status !== 'SUSPENDED',
      approvedAt: payload.status === 'APPROVED' ? new Date() : null,
      approvedByUserId: payload.status === 'APPROVED' ? req.user!.id : null,
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

  await safeCreateAuditLog({
    actorUserId: req.user!.id,
    restaurantId,
    action: `PLATFORM_RESTAURANT_${payload.status}`,
    entityType: 'restaurant',
    entityId: restaurantId,
    metadata: payload,
  });

  return res.json({
    success: true,
    data: { restaurant },
    message: `Restaurant ${payload.status.toLowerCase()} successfully`,
  });
});

// PATCH /api/platform/restaurants/:id/commission
router.patch('/restaurants/:id/commission', async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.params['id'];
  if (!restaurantId) {
    return res.status(400).json({ success: false, error: 'Restaurant id is required' });
  }

  const payload = updateCommissionSchema.parse(req.body);

  const restaurant = await prisma.restaurant.update({
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

  await safeCreateAuditLog({
    actorUserId: req.user!.id,
    restaurantId,
    action: 'PLATFORM_COMMISSION_UPDATED',
    entityType: 'restaurant',
    entityId: restaurantId,
    metadata: payload,
  });

  return res.json({
    success: true,
    data: { restaurant },
    message: 'Commission updated successfully',
  });
});

// PATCH /api/platform/restaurants/:id/details
router.patch('/restaurants/:id/details', async (req: AuthenticatedRequest, res: Response) => {
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

  const restaurant = await prisma.restaurant.update({
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

  await safeCreateAuditLog({
    actorUserId: req.user!.id,
    restaurantId,
    action: 'PLATFORM_RESTAURANT_DETAILS_UPDATED',
    entityType: 'restaurant',
    entityId: restaurantId,
    metadata: payload,
  });

  return res.json({
    success: true,
    data: { restaurant },
    message: 'Restaurant details updated',
  });
});

// GET /api/platform/orders
router.get('/orders', async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.query['restaurantId'] as string | undefined;

  const take = typeof req.query.take !== 'undefined' ? Math.min(Number(req.query.take) || 0, 500) : undefined;
  const cursor = req.query.cursor ? { id: String(req.query.cursor) } : undefined;

  const orders = await prisma.order.findMany({
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
    ...(typeof take === 'number' ? { take } : { take: 500 }),
    ...(cursor ? { cursor, skip: 1 } : {}),
  });

  return res.json({ success: true, data: { orders } });
});

// GET /api/platform/earnings
router.get('/earnings', async (_req: AuthenticatedRequest, res: Response) => {
  const [totals, pendingSettlements, byRestaurant] = await Promise.all([
    (prisma as any).earning.aggregate({
      _sum: {
        grossAmountPaise: true,
        platformCommissionPaise: true,
        restaurantEarningPaise: true,
      },
      ...(accelerateCache(60, 120) as any),
    }),
    (prisma as any).earning.aggregate({
      where: { settled: false },
      _sum: {
        restaurantEarningPaise: true,
      },
      ...(accelerateCache(60, 120) as any),
    }),
    // Cast to any to avoid overly strict groupBy overload typing issues across Prisma versions
    (prisma as any).earning.groupBy({
      by: ['restaurantId'],
      _sum: {
        grossAmountPaise: true,
        platformCommissionPaise: true,
        restaurantEarningPaise: true,
      },
      _count: {
        _all: true,
      },
      ...(accelerateCache(60, 120) as any),
    }),
  ]);

  const restaurants = await prisma.restaurant.findMany({
    where: { id: { in: byRestaurant.map((entry: { restaurantId: string }) => entry.restaurantId) } },
    select: { id: true, name: true },
    ...(accelerateCache(60, 120) as any),
  });

  const restaurantNameById = new Map(restaurants.map((r: { id: string; name: string }) => [r.id, r.name]));

  return res.json({
    success: true,
    data: {
      totals: {
        grossAmountPaise: totals._sum.grossAmountPaise || 0,
        platformCommissionPaise: totals._sum.platformCommissionPaise || 0,
        restaurantEarningPaise: totals._sum.restaurantEarningPaise || 0,
        pendingRestaurantSettlementPaise: pendingSettlements._sum?.restaurantEarningPaise || 0,
      },
      byRestaurant: byRestaurant.map((entry: {
        restaurantId: string;
        _count: { _all: number };
        _sum: {
          grossAmountPaise: number | null;
          platformCommissionPaise: number | null;
          restaurantEarningPaise: number | null;
        };
      }) => ({
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

export default router;
