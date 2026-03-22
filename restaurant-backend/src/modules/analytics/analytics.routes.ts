import { Router } from 'express';
import { z } from 'zod';
import { AnalyticsPeriodType } from '@prisma/client';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';
import { generateAnalyticsSnapshot, getAnalyticsOverview } from '@/modules/analytics/analytics.service';
import { prisma } from '@/config/database';

const router = Router();

const dateQuerySchema = z.object({
  date: z.string().optional(),
});

const overviewQuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

const parseDateInput = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date format');
  }
  return date;
};

router.use(authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'));

router.get('/daily', async (req: AuthenticatedRequest, res) => {
  try {
    const query = dateQuerySchema.parse(req.query);
    const date = parseDateInput(query.date) || new Date();
    const snapshot = await generateAnalyticsSnapshot({
      restaurantId: req.restaurant!.id,
      periodType: AnalyticsPeriodType.DAILY,
      date,
    });

    return res.json({ success: true, data: snapshot });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
    }

    if (error instanceof Error && error.message === 'Invalid date format') {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: 'Failed to generate daily analytics' });
  }
});

router.get('/weekly', async (req: AuthenticatedRequest, res) => {
  try {
    const query = dateQuerySchema.parse(req.query);
    const date = parseDateInput(query.date) || new Date();
    const snapshot = await generateAnalyticsSnapshot({
      restaurantId: req.restaurant!.id,
      periodType: AnalyticsPeriodType.WEEKLY,
      date,
    });

    return res.json({ success: true, data: snapshot });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
    }

    if (error instanceof Error && error.message === 'Invalid date format') {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: 'Failed to generate weekly analytics' });
  }
});

router.get('/overview', async (req: AuthenticatedRequest, res) => {
  try {
    const query = overviewQuerySchema.parse(req.query);
    const end = parseDateInput(query.end) || new Date();
    const start = parseDateInput(query.start) || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const overview = await getAnalyticsOverview({
      restaurantId: req.restaurant!.id,
      start,
      end,
    });
    return res.json({ success: true, data: overview });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
    }

    if (error instanceof Error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: 'Failed to generate analytics overview' });
  }
});

router.get('/history', async (req: AuthenticatedRequest, res) => {
  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: {
      restaurantId: req.restaurant!.id,
    },
    orderBy: { generatedAt: 'desc' },
    take: 30,
  });

  return res.json({ success: true, data: snapshots });
});

export default router;
