import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';
import {
  createIntegratedPosOrder,
  createMarketplaceIntegratedOrder,
  getMarketplaceIntegratedOrders,
} from '@/modules/pos/pos.service';
import { InventoryError } from '@/modules/inventory/inventory.service';
import { prisma } from '@/config/database';

const router = Router();

const marketplaceSourceSchema = z.enum(['ZOMATO', 'SWIGGY']);

const createPosOrderSchema = z.object({
  sourceSystem: z.string().min(2).max(60),
  externalOrderId: z.string().max(120).optional(),
  userId: z.string().min(1),
  tableId: z.string().min(1),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().positive(),
        notes: z.string().max(200).optional(),
      })
    )
    .min(1),
  specialInstructions: z.string().max(400).optional(),
  couponCode: z.string().max(40).optional(),
  paymentProvider: z.enum(['RAZORPAY', 'PAYTM', 'PHONEPE', 'CASH']).optional(),
});

const marketplaceOrderSchema = z.object({
  externalOrderId: z.string().min(1).max(120),
  customer: z.object({
    name: z.string().min(1).max(80),
    phone: z.string().max(25).optional(),
    email: z.string().email().max(120).optional(),
    address: z.string().min(1).max(240),
    landmark: z.string().max(120).optional(),
  }),
  items: z
    .array(
      z
        .object({
          menuItemId: z.string().max(120).optional(),
          menuItemName: z.string().max(120).optional(),
          quantity: z.number().int().positive(),
          notes: z.string().max(200).optional(),
        })
        .superRefine((item, ctx) => {
          const hasId = Boolean(item.menuItemId && item.menuItemId.trim());
          const hasName = Boolean(item.menuItemName && item.menuItemName.trim());
          if (!hasId && !hasName) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Each item must include either menuItemId or menuItemName',
            });
          }
        })
    )
    .min(1),
  specialInstructions: z.string().max(400).optional(),
  paymentProvider: z.enum(['RAZORPAY', 'PAYTM', 'PHONEPE', 'CASH']).optional(),
  paymentStatus: z
    .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_PAID'])
    .optional(),
  paidAmountPaise: z.number().int().min(0).optional(),
});

const marketplaceQuerySchema = z.object({
  sourceSystem: marketplaceSourceSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
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
      externalOrderId?: string;
      items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
      specialInstructions?: string;
      couponCode?: string;
      paymentProvider?: 'RAZORPAY' | 'PAYTM' | 'PHONEPE' | 'CASH';
      createdByUserId?: string;
    } = {
      restaurantId: req.restaurant!.id,
      userId: payload.userId,
      tableId: payload.tableId,
      sourceSystem: payload.sourceSystem,
      items: payload.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        ...(item.notes ? { notes: item.notes } : {}),
      })),
    };

    if (payload.externalOrderId) createPayload.externalOrderId = payload.externalOrderId;
    if (payload.specialInstructions) createPayload.specialInstructions = payload.specialInstructions;
    if (payload.couponCode) createPayload.couponCode = payload.couponCode;
    if (payload.paymentProvider) createPayload.paymentProvider = payload.paymentProvider;
    if (req.user?.id) createPayload.createdByUserId = req.user.id;

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

router.post('/integrations/:platform/orders', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const platform = marketplaceSourceSchema.parse(String(req.params['platform'] || '').toUpperCase());
    const payload = marketplaceOrderSchema.parse(req.body);

    const customerPayload = {
      name: payload.customer.name,
      address: payload.customer.address,
      ...(payload.customer.phone ? { phone: payload.customer.phone } : {}),
      ...(payload.customer.email ? { email: payload.customer.email } : {}),
      ...(payload.customer.landmark ? { landmark: payload.customer.landmark } : {}),
    };

    const itemsPayload = payload.items.map((item) => ({
      quantity: item.quantity,
      ...(item.menuItemId ? { menuItemId: item.menuItemId } : {}),
      ...(item.menuItemName ? { menuItemName: item.menuItemName } : {}),
      ...(item.notes ? { notes: item.notes } : {}),
    }));

    const createPayload = {
      restaurantId: req.restaurant!.id,
      sourceSystem: platform,
      externalOrderId: payload.externalOrderId,
      customer: customerPayload,
      items: itemsPayload,
      ...(payload.specialInstructions ? { specialInstructions: payload.specialInstructions } : {}),
      ...(payload.paymentProvider ? { paymentProvider: payload.paymentProvider } : {}),
      ...(payload.paymentStatus ? { paymentStatus: payload.paymentStatus } : {}),
      ...(typeof payload.paidAmountPaise === 'number' ? { paidAmountPaise: payload.paidAmountPaise } : {}),
      ...(req.user?.id ? { createdByUserId: req.user.id } : {}),
    };

    const created = await createMarketplaceIntegratedOrder(createPayload);

    const replayed = Boolean((created as { idempotentReplay?: boolean }).idempotentReplay);

    return res.status(replayed ? 200 : 201).json({
      success: true,
      data: created,
      message: replayed
        ? `${platform} order already integrated. Returning existing workflow state`
        : `${platform} order integrated successfully`,
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

    return res.status(500).json({ success: false, error: 'Failed to integrate marketplace order' });
  }
});

router.get('/integrations/orders', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = marketplaceQuerySchema.parse({
      sourceSystem: req.query['sourceSystem'] ? String(req.query['sourceSystem']).toUpperCase() : undefined,
      limit: req.query['limit'],
    });

    const queryPayload = {
      restaurantId: req.restaurant!.id,
      ...(parsed.sourceSystem ? { sourceSystem: parsed.sourceSystem } : {}),
      ...(typeof parsed.limit === 'number' ? { limit: parsed.limit } : {}),
    };

    const orders = await getMarketplaceIntegratedOrders(queryPayload);

    return res.json({
      success: true,
      data: orders,
      message: 'Marketplace integrated orders fetched successfully',
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query params', details: error.issues });
    }

    if (error instanceof Error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({ success: false, error: 'Failed to fetch marketplace orders' });
  }
});

router.get('/sync/logs', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  const sourceSystem = req.query['sourceSystem'] ? String(req.query['sourceSystem']) : null;

  const logs = await prisma.posSyncLog.findMany({
    where: {
      restaurantId: req.restaurant!.id,
      ...(sourceSystem ? { sourceSystem } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return res.json({ success: true, data: logs });
});

export default router;
