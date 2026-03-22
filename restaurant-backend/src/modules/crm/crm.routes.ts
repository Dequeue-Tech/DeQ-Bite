import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';
import { prisma } from '@/config/database';
import {
  buildCrmSegmentsSummary,
  classifyCrmSegment,
  computeCrmHealth,
  redeemLoyaltyPoints,
} from '@/modules/crm/crm.service';

const router = Router();

const redeemSchema = z.object({
  points: z.number().int().positive(),
  reason: z.string().max(200).optional(),
});

const customerQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
  segment: z.enum(['NEW', 'LOYAL', 'HIGH_VALUE', 'AT_RISK', 'REGULAR']).optional(),
  minPoints: z.coerce.number().int().nonnegative().optional(),
  sortBy: z.enum(['LOYALTY', 'SPEND', 'LAST_ORDER']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const notesSchema = z.object({
  notes: z.string().max(500).nullable(),
});

router.use(authenticate, requireRestaurant);

router.get('/customers', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const query = customerQuerySchema.parse(req.query);
    const q = query.q;
    const page = query.page || 1;
    const limit = query.limit || 60;
    const direction = query.direction || 'desc';
    const sortBy = query.sortBy || 'LOYALTY';

    const customers = await prisma.customerProfile.findMany({
      where: {
        restaurantId: req.restaurant!.id,
        ...(query.tier ? { tier: query.tier } : {}),
        ...(typeof query.minPoints === 'number' ? { loyaltyPoints: { gte: query.minPoints } } : {}),
        ...(q
          ? {
              user: {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                  { phone: { contains: q, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
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
      orderBy:
        sortBy === 'SPEND'
          ? [{ totalSpendPaise: direction }]
          : sortBy === 'LAST_ORDER'
            ? [{ lastOrderAt: direction }, { loyaltyPoints: 'desc' }]
            : [{ loyaltyPoints: direction }, { totalSpendPaise: 'desc' }],
    });

    const enriched = customers
      .map((profile: any) => {
        const segment = classifyCrmSegment(profile);
        const health = computeCrmHealth(profile);
        return {
          ...profile,
          segment,
          health,
        };
      })
      .filter((profile: any) => (query.segment ? profile.segment === query.segment : true));

    const total = enriched.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const pagedData = enriched.slice(offset, offset + limit);

    return res.json({
      success: true,
      data: pagedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
    }
    return res.status(500).json({ success: false, error: 'Failed to fetch customers' });
  }
});

router.get('/customers/overview', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  const profiles = await prisma.customerProfile.findMany({
    where: {
      restaurantId: req.restaurant!.id,
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
    orderBy: [{ totalSpendPaise: 'desc' }],
  });

  const enriched = profiles.map((profile: any) => {
    const segment = classifyCrmSegment(profile);
    const health = computeCrmHealth(profile);
    return {
      ...profile,
      segment,
      health,
    };
  });

  const summary = buildCrmSegmentsSummary(enriched);
  const atRisk = enriched
    .filter((profile: any) => profile.health.risk === 'HIGH' || profile.segment === 'AT_RISK')
    .sort((a: any, b: any) => a.health.score - b.health.score)
    .slice(0, 10);

  const highValue = enriched
    .filter((profile: any) => profile.segment === 'HIGH_VALUE' || profile.segment === 'LOYAL')
    .sort((a: any, b: any) => b.totalSpendPaise - a.totalSpendPaise)
    .slice(0, 10);

  return res.json({
    success: true,
    data: {
      summary,
      atRisk,
      highValue,
    },
  });
});

router.get('/customers/:userId', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  const userId = req.params['userId'] as string;

  const profile = await prisma.customerProfile.findUnique({
    where: {
      restaurantId_userId: {
        restaurantId: req.restaurant!.id,
        userId,
      },
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
      loyaltyLedger: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      couponRedemptions: {
        orderBy: { redeemedAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!profile) {
    return res.status(404).json({ success: false, error: 'Customer profile not found' });
  }

  const orderHistory = await prisma.order.findMany({
    where: {
      restaurantId: req.restaurant!.id,
      userId,
    },
    include: {
      items: {
        include: {
          menuItem: true,
        },
      },
      table: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return res.json({ success: true, data: { profile, orderHistory } });
});

router.get('/me', async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const profile = await prisma.customerProfile.findUnique({
    where: {
      restaurantId_userId: {
        restaurantId: req.restaurant!.id,
        userId: req.user.id,
      },
    },
    include: {
      loyaltyLedger: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      couponRedemptions: {
        orderBy: { redeemedAt: 'desc' },
        take: 20,
      },
    },
  });

  return res.json({ success: true, data: profile });
});

router.patch('/customers/:userId/notes', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.params['userId'] as string;
    const payload = notesSchema.parse(req.body);

    const updated = await prisma.customerProfile.update({
      where: {
        restaurantId_userId: {
          restaurantId: req.restaurant!.id,
          userId,
        },
      },
      data: {
        notes: payload.notes,
      },
    });

    return res.json({ success: true, data: updated, message: 'Customer notes updated' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
    }
    return res.status(500).json({ success: false, error: 'Failed to update customer notes' });
  }
});

router.post('/customers/:userId/redeem-points', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.params['userId'] as string;
    const payload = redeemSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const redeemPayload: {
        restaurantId: string;
        userId: string;
        points: number;
        reason?: string | undefined;
        createdByUserId?: string | undefined;
      } = {
        restaurantId: req.restaurant!.id,
        userId,
        points: payload.points,
        createdByUserId: req.user?.id,
      };
      if (payload.reason) redeemPayload.reason = payload.reason;
      return redeemLoyaltyPoints(tx, redeemPayload);
    });

    return res.json({ success: true, data: updated, message: 'Loyalty points redeemed' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
    }

    if (error instanceof Error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: 'Failed to redeem points' });
  }
});

export default router;
