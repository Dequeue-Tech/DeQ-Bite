import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';
import { createIntegratedPosOrder } from '@/modules/pos/pos.service';
import { InventoryError } from '@/modules/inventory/inventory.service';
import { prisma } from '@/config/database';

const router = Router();

const createPosOrderSchema = z.object({
  sourceSystem: z.string().min(2).max(60),
  externalOrderId: z.string().max(120).optional(),
  userId: z.string().min(1),
  tableId: z.string().min(1),
  items: z.array(z.object({
    menuItemId: z.string().min(1),
    quantity: z.number().int().positive(),
    notes: z.string().max(200).optional(),
  })).min(1),
  specialInstructions: z.string().max(400).optional(),
  couponCode: z.string().max(40).optional(),
  paymentProvider: z.enum(['RAZORPAY', 'PAYTM', 'PHONEPE', 'CASH']).optional(),
});

router.use(authenticate, requireRestaurant);

router.post('/sync/orders', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = createPosOrderSchema.parse(req.body);
    const createPayload: {
      restaurantId: string;
      userId: string;
      tableId: string;
      sourceSystem: string;
      externalOrderId?: string | undefined;
      items: Array<{ menuItemId: string; quantity: number; notes?: string | undefined }>;
      specialInstructions?: string | undefined;
      couponCode?: string | undefined;
      paymentProvider?: 'RAZORPAY' | 'PAYTM' | 'PHONEPE' | 'CASH' | undefined;
      createdByUserId?: string | undefined;
    } = {
      restaurantId: req.restaurant!.id,
      userId: payload.userId,
      tableId: payload.tableId,
      sourceSystem: payload.sourceSystem,
      createdByUserId: req.user?.id,
      items: payload.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
      })),
    };
    if (payload.externalOrderId) createPayload.externalOrderId = payload.externalOrderId;
    if (payload.specialInstructions) createPayload.specialInstructions = payload.specialInstructions;
    if (payload.couponCode) createPayload.couponCode = payload.couponCode;
    if (payload.paymentProvider) createPayload.paymentProvider = payload.paymentProvider;

    const created = await createIntegratedPosOrder(createPayload);
    const replayed = Boolean((created as { idempotentReplay?: boolean }).idempotentReplay);

    return res.status(replayed ? 200 : 201).json({
      success: true,
      data: created,
      message: replayed
        ? 'POS order already synced. Returning existing operational workflow state'
        : 'POS order synced and operational workflows completed',
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
    }

    if (error instanceof InventoryError) {
      return res.status(error.statusCode).json({ success: false, error: error.message, details: error.details });
    }

    if (error instanceof Error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: 'Failed to sync POS order' });
  }
});

router.get('/sync/logs', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  const logs = await prisma.posSyncLog.findMany({
    where: {
      restaurantId: req.restaurant!.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return res.json({ success: true, data: logs });
});

export default router;
