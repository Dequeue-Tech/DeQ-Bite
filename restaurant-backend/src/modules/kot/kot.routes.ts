import { Router } from 'express';
import { z } from 'zod';
import { KOTStatus } from '@prisma/client';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';
import { prisma } from '@/config/database';
import {
  getKOTOperationalSummary,
  updateKOTPriority,
  updateKOTStatus,
  KOTError,
} from '@/modules/kot/kot.service';

const router = Router();

const statusSchema = z.object({
  status: z.nativeEnum(KOTStatus),
  note: z.string().max(300).optional(),
});

const summaryQuerySchema = z.object({
  overdueMinutes: z.coerce.number().int().min(5).max(180).optional(),
});

const prioritySchema = z.object({
  priority: z.number().int().min(-5).max(5),
  note: z.string().max(300).optional(),
});

router.use(authenticate, requireRestaurant);

router.get('/tickets', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  const status = req.query['status'] as KOTStatus | undefined;

  const tickets = await prisma.kOTTicket.findMany({
    where: {
      restaurantId: req.restaurant!.id,
      ...(status ? { status } : {}),
    },
    include: {
      order: {
        include: {
          table: true,
          items: { include: { menuItem: true } },
        },
      },
    },
    orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
  });

  return res.json({ success: true, data: tickets });
});

router.get('/summary', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const query = summaryQuerySchema.parse(req.query);
    const summaryPayload: {
      restaurantId: string;
      overdueThresholdMinutes?: number;
    } = {
      restaurantId: req.restaurant!.id,
    };

    if (typeof query.overdueMinutes === 'number') {
      summaryPayload.overdueThresholdMinutes = query.overdueMinutes;
    }

    const summary = await getKOTOperationalSummary(summaryPayload);

    return res.json({ success: true, data: summary });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
    }
    return res.status(500).json({ success: false, error: 'Failed to fetch KOT summary' });
  }
});

router.get('/tickets/order/:orderId', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  const orderId = req.params['orderId'] as string;
  const ticket = await prisma.kOTTicket.findFirst({
    where: { restaurantId: req.restaurant!.id, orderId },
    include: {
      order: {
        include: {
          table: true,
          items: { include: { menuItem: true } },
        },
      },
      events: {
        orderBy: { changedAt: 'asc' },
      },
    },
  });

  if (!ticket) {
    return res.status(404).json({ success: false, error: 'KOT ticket not found' });
  }

  return res.json({ success: true, data: ticket });
});

router.patch('/tickets/order/:orderId/status', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const orderId = req.params['orderId'] as string;
    const payload = statusSchema.parse(req.body);
    const updatePayload: {
      restaurantId: string;
      orderId: string;
      status: KOTStatus;
      note?: string | undefined;
      changedByUserId?: string | undefined;
    } = {
      restaurantId: req.restaurant!.id,
      orderId,
      status: payload.status,
    };
    if (payload.note) updatePayload.note = payload.note;
    if (req.user?.id) updatePayload.changedByUserId = req.user.id;

    const updated = await updateKOTStatus(updatePayload);

    return res.json({ success: true, data: updated, message: 'KOT status updated' });
  } catch (error: unknown) {
    if (error instanceof KOTError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
    }

    return res.status(500).json({ success: false, error: 'Failed to update KOT status' });
  }
});

router.patch('/tickets/order/:orderId/priority', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const orderId = req.params['orderId'] as string;
    const payload = prioritySchema.parse(req.body);
    const updatePayload: {
      restaurantId: string;
      orderId: string;
      priority: number;
      note?: string | undefined;
      changedByUserId?: string | undefined;
    } = {
      restaurantId: req.restaurant!.id,
      orderId,
      priority: payload.priority,
    };

    if (payload.note) updatePayload.note = payload.note;
    if (req.user?.id) updatePayload.changedByUserId = req.user.id;

    const updated = await updateKOTPriority(updatePayload);
    return res.json({ success: true, data: updated, message: 'KOT priority updated' });
  } catch (error: unknown) {
    if (error instanceof KOTError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
    }

    return res.status(500).json({ success: false, error: 'Failed to update KOT priority' });
  }
});

export default router;
