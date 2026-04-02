import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import { requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';
import { AppError, asyncHandler } from '@/middleware/errorHandler';
import {
  deactivatePushSubscription,
  getPublicVapidKey,
  upsertPushSubscription,
} from '@/services/push-notification.service';

const router = Router();

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const subscribeSchema = z.object({
  roleScope: z.enum(['admin', 'staff', 'customer', 'rider']).optional(),
  subscription: subscriptionSchema,
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

router.get('/vapid-public-key', authenticate, requireRestaurant, asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const publicKey = getPublicVapidKey();
  if (!publicKey) {
    throw new AppError('Push notification key is not configured', 503);
  }
  return res.json({
    success: true,
    data: { publicKey },
  });
}));

router.post('/subscribe', authenticate, requireRestaurant, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) throw new AppError('Unauthorized', 401);
  const payload = subscribeSchema.parse(req.body);

  const record = await upsertPushSubscription({
    restaurantId: req.restaurant!.id,
    userId: req.user.id,
    ...(payload.roleScope ? { roleScope: payload.roleScope } : {}),
    userAgent: req.get('user-agent') || '',
    subscription: payload.subscription,
  });

  return res.status(201).json({
    success: true,
    message: 'Push subscription saved',
    data: { id: record.id, roleScope: record.roleScope },
  });
}));

router.delete('/unsubscribe', authenticate, requireRestaurant, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) throw new AppError('Unauthorized', 401);
  const payload = unsubscribeSchema.parse(req.body);

  await deactivatePushSubscription({
    restaurantId: req.restaurant!.id,
    userId: req.user.id,
    endpoint: payload.endpoint,
  });

  return res.json({
    success: true,
    message: 'Push subscription removed',
  });
}));

export default router;
