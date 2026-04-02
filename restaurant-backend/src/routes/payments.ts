import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { AppError, asyncHandler } from '@/middleware/errorHandler';
import { getEnabledProviders, getPaymentProvider, PaymentProviderType } from '@/lib/payments';
import { AuthenticatedRequest, ApiResponse } from '@/types/api';
import { logger } from '@/utils/logger';
import { safeCreateAuditLog } from '@/utils/audit';
import { generateInvoicePDF, savePDFToStorage } from '@/lib/pdf';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { emitRestaurantEvent } from '@/utils/realtime';
import { cacheResponse } from '@/middleware/cache';
import { processOrderCompletionNotifications } from '@/services/order-completion.service';
import { notifyOrderStatusChange } from '@/services/order-status-notification.service';
import { extractIdempotencyKey, claimIdempotencyKey } from '@/utils/idempotency';
import { extractExpectedUpdatedAt, hasVersionConflict } from '@/utils/order-lock';
import { syncKOTTicketFromOrderStatus } from '@/modules/kot/kot.service';
import { resolveOrderPlacementContact } from '@/services/order-contact.service';

const router = Router();
const staleWriteMessage = 'This order was just updated by someone else. Refreshing…';

const createPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  paymentProvider: z.enum(['RAZORPAY', 'PAYTM', 'PHONEPE']).optional(),
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Razorpay order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Razorpay payment ID is required'),
  razorpay_signature: z.string().min(1, 'Razorpay signature is required'),
});

const refundPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
});

const cashConfirmSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  amountPaise: z.number().int().positive().optional(),
});

const updatePaymentStatusSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  paymentStatus: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_PAID']),
  paidAmountPaise: z.number().int().nonnegative().optional(),
});

const computeDueAndStatus = (totalPaise: number, paidAmountPaise: number) => {
  const boundedPaid = Math.max(0, Math.min(paidAmountPaise, totalPaise));
  const dueAmountPaise = Math.max(totalPaise - boundedPaid, 0);
  const paymentStatus =
    dueAmountPaise === 0
      ? 'COMPLETED'
      : boundedPaid > 0
        ? 'PARTIALLY_PAID'
        : 'PENDING';

  return {
    paidAmountPaise: boundedPaid,
    dueAmountPaise,
    paymentStatus,
  } as const;
};

const ensureInvoiceAndEarningForFullyPaidOrder = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      restaurant: {
        select: {
          name: true,
          address: true,
          phone: true,
          commissionRate: true,
        },
      },
      table: {
        select: {
          number: true,
        },
      },
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
      items: {
        include: {
          menuItem: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!order || order.paymentStatus !== 'COMPLETED') return;

  const existingInvoice = await prisma.invoice.findUnique({
    where: { orderId: order.id },
  });

  if (!existingInvoice) {
    const invoiceNumber = `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;
    const placementContact = resolveOrderPlacementContact(order);
    const customerName = placementContact.name || order.user?.name || 'Guest';
    const customerEmail = placementContact.email || undefined;
    const customerPhone = placementContact.phone || '';
    const tableNumber = order.table?.number ? String(order.table.number) : 'N/A';

    const invoiceData = {
      customerName,
      ...(customerEmail ? { customerEmail } : {}),
      customerPhone,
      invoiceNumber,
      orderDate: order.createdAt.toLocaleDateString('en-IN'),
      items: order.items.map((item: any) => ({
        name: item.menuItem.name,
        quantity: item.quantity,
        price: item.pricePaise / 100,
        total: (item.pricePaise * item.quantity) / 100,
      })),
      subtotal: order.subtotalPaise / 100,
      tax: order.taxPaise / 100,
      total: order.totalPaise / 100,
      tableNumber,
      restaurantName: order.restaurant.name,
      paymentMethod: `Payment (${order.paymentProvider})`,
      ...(order.restaurant.address ? { restaurantAddress: order.restaurant.address } : {}),
      ...(order.restaurant.phone ? { restaurantPhone: order.restaurant.phone } : {}),
    };

    const pdfBuffer = generateInvoicePDF(invoiceData);
    const pdfFileName = `invoice-${invoiceNumber}.pdf`;
    const pdfStorageResult = await savePDFToStorage(pdfBuffer, pdfFileName);

    await prisma.invoice.create({
      data: {
        orderId: order.id,
        invoiceNumber,
        sentVia: [],
        emailSent: false,
        smsSent: false,
        pdfPath: pdfStorageResult.pdfPath,
        pdfData: pdfStorageResult.pdfData,
        pdfName: pdfStorageResult.pdfName,
      },
    });
  }

  const existingEarning = await prisma.earning.findUnique({
    where: {
      orderId: order.id,
    },
  });

  if (!existingEarning) {
    const platformCommissionPaise = Math.round(order.totalPaise * (order.restaurant.commissionRate / 100));
    const restaurantEarningPaise = order.totalPaise - platformCommissionPaise;

    await prisma.earning.create({
      data: {
        restaurantId: order.restaurantId,
        orderId: order.id,
        grossAmountPaise: order.totalPaise,
        platformCommissionPaise,
        restaurantEarningPaise,
      },
    });
  }
};

const buildOrderEventPayload = (order: any) => {
  const payloadOrder: any = {
    id: order.id,
    orderId: order.id,
    order_id: order.id,
    userId: order.userId,
    tableId: order.tableId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentProvider: order.paymentProvider,
    paidAmountPaise: order.paidAmountPaise,
    dueAmountPaise: order.dueAmountPaise,
    totalPaise: order.totalPaise,
    updatedAt: order.updatedAt,
    createdAt: order.createdAt,
  };

  if (order.table) payloadOrder.table = order.table;
  if (order.items) payloadOrder.items = order.items;
  if (order.user) payloadOrder.user = order.user;
  if (typeof order.subtotalPaise === 'number') payloadOrder.subtotalPaise = order.subtotalPaise;
  if (typeof order.taxPaise === 'number') payloadOrder.taxPaise = order.taxPaise;
  if (typeof order.discountPaise === 'number') payloadOrder.discountPaise = order.discountPaise;

  return { order: payloadOrder };
};

const emitAcceptedNotificationIfNeeded = (previousStatus: string, order: any) => {
  if (previousStatus !== 'PENDING' || order.status !== 'CONFIRMED') {
    return;
  }

  emitRestaurantEvent(order.restaurantId, {
    type: 'order.accepted',
    userId: order.userId,
    payload: {
      ...buildOrderEventPayload(order),
      message: 'Your order has been accepted.',
    },
  });
};

const ensureMutationIdempotency = async (req: AuthenticatedRequest, scope: string) => {
  const key = extractIdempotencyKey(req);
  if (!key) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Idempotency-Key header is required for order mutations',
    } as const;
  }

  const claimed = await claimIdempotencyKey({ scope, key });
  if (!claimed) {
    return {
      ok: false,
      statusCode: 409,
      error: 'Duplicate order mutation ignored',
    } as const;
  }

  return { ok: true } as const;
};

const ensureOrderVersion = (req: AuthenticatedRequest, currentUpdatedAt: Date) => {
  const expectedUpdatedAt = extractExpectedUpdatedAt(req);
  if (!expectedUpdatedAt) {
    return {
      ok: false,
      statusCode: 400,
      error: 'expectedUpdatedAt is required for order mutations',
    } as const;
  }

  if (hasVersionConflict({ expectedUpdatedAt, currentUpdatedAt })) {
    return {
      ok: false,
      statusCode: 409,
      error: staleWriteMessage,
    } as const;
  }

  return { ok: true } as const;
};

// GET /api/payments/providers
router.get('/providers', requireRestaurant, cacheResponse(300, 'payments:providers'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const providers = [
    ...getEnabledProviders(),
    ...(req.restaurant?.cashPaymentEnabled ? ['CASH'] : []),
  ];

  const response: ApiResponse = {
    success: true,
    data: { providers },
  };

  return res.json(response);
}));

// POST /api/payments/create
router.post('/create', authenticate, requireRestaurant, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { orderId, paymentProvider } = createPaymentSchema.parse(req.body);

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: req.user!.id,
      restaurantId: req.restaurant!.id,
      paymentStatus: {
        in: ['PENDING', 'FAILED', 'PROCESSING', 'PARTIALLY_PAID'],
      },
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
      table: {
        select: {
          number: true,
          location: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError('Order not found or already processed', 404);
  }

  if (order.paymentProvider === 'CASH') {
    throw new AppError('This order uses cash payment. Ask manager/admin to confirm payment.', 400);
  }

  if ((order.dueAmountPaise || 0) <= 0) {
    throw new AppError('Order is already fully paid', 400);
  }

  const providerToUse = (paymentProvider || order.paymentProvider || 'RAZORPAY') as PaymentProviderType;
  const provider = getPaymentProvider(providerToUse);

  if (!provider.isEnabled()) {
    throw new AppError(`${providerToUse} is not enabled`, 400);
  }

  const paymentOrder = await provider.createOrder({
    amountPaise: order.dueAmountPaise || order.totalPaise,
    receipt: `order_${order.id}`,
    notes: {
      orderId: order.id,
      userId: req.user!.id,
      tableId: order.tableId,
      customerName: order.user.name,
      tableNumber: String(order.table.number),
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentId: paymentOrder.paymentOrderId,
      paymentProvider: providerToUse,
      paymentStatus: 'PROCESSING',
    },
  });

  logger.info('Payment order created', {
    orderId,
    paymentOrderId: paymentOrder.paymentOrderId,
    amountPaise: paymentOrder.amountPaise,
    userId: req.user!.id,
  });

  const response: ApiResponse = {
    success: true,
    message: 'Payment order created successfully',
    data: {
      paymentOrderId: paymentOrder.paymentOrderId,
      amountPaise: paymentOrder.amountPaise,
      currency: paymentOrder.currency,
      provider: paymentOrder.provider,
      publicKey: paymentOrder.publicKey,
      redirectUrl: paymentOrder.redirectUrl,
      orderId: order.id,
      customerDetails: {
        name: order.user.name,
        email: order.user.email,
        phone: order.user.phone,
      },
    },
  };

  return res.status(201).json(response);
}));

// POST /api/payments/verify
router.post('/verify', authenticate, requireRestaurant, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verifyPaymentSchema.parse(req.body);

  const order = await prisma.order.findFirst({
    where: {
      paymentId: razorpay_order_id,
      userId: req.user!.id,
      restaurantId: req.restaurant!.id,
    },
  });

  if (!order) {
    throw new AppError('Order not found. Payment reference does not match any order.', 404);
  }

  if (order.paymentStatus === 'COMPLETED') {
    const response: ApiResponse = {
      success: true,
      message: 'Payment already verified',
      data: { order },
    };
    return res.json(response);
  }

  const provider = getPaymentProvider(order.paymentProvider as PaymentProviderType);
  await provider.verifyPayment({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  const amountPaidNow = order.dueAmountPaise || Math.max(order.totalPaise - order.paidAmountPaise, 0);
  const nextPaid = order.paidAmountPaise + amountPaidNow;
  const computed = computeDueAndStatus(order.totalPaise, nextPaid);

  const [, updatedOrder] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: computed.paymentStatus,
        paidAmountPaise: computed.paidAmountPaise,
        dueAmountPaise: computed.dueAmountPaise,
        status: computed.dueAmountPaise === 0 ? 'CONFIRMED' : order.status,
        paymentTransactionId: razorpay_payment_id,
        updatedAt: new Date(),
      },
      include: {
        table: {
          select: {
            number: true,
            location: true,
          },
        },
        items: {
          include: {
            menuItem: {
              select: {
                name: true,
                pricePaise: true,
              },
            },
          },
        },
      },
    }),
    prisma.payment.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        restaurantId: order.restaurantId,
        method: 'ONLINE',
        provider: order.paymentProvider,
        amountPaise: amountPaidNow,
        status: computed.paymentStatus,
        providerOrderId: razorpay_order_id,
        providerPaymentId: razorpay_payment_id,
        providerSignature: razorpay_signature,
      },
    }),
  ]);

  await safeCreateAuditLog({
    actorUserId: req.user!.id,
    restaurantId: order.restaurantId,
    action: 'PAYMENT_VERIFIED',
    entityType: 'order',
    entityId: order.id,
    metadata: {
      amountPaidNow,
      paymentStatus: computed.paymentStatus,
      dueAmountPaise: computed.dueAmountPaise,
      providerPaymentId: razorpay_payment_id,
    },
  });

  await ensureInvoiceAndEarningForFullyPaidOrder(order.id);
  await processOrderCompletionNotifications(order.id).catch((error) => {
    logger.error('Order completion notification pipeline failed after payment verify', {
      orderId: order.id,
      message: error instanceof Error ? error.message : String(error),
    });
  });

  await syncKOTTicketFromOrderStatus({
    restaurantId: updatedOrder.restaurantId,
    orderId: updatedOrder.id,
    orderStatus: updatedOrder.status,
    changedByUserId: req.user?.id,
    note: `Synced from payment verification (${updatedOrder.status})`,
    createIfMissing: !updatedOrder.isDelivery,
    skipForDeliveryOrder: Boolean(updatedOrder.isDelivery),
  });
  emitAcceptedNotificationIfNeeded(order.status, updatedOrder);
  await notifyOrderStatusChange({
    orderId: updatedOrder.id,
    previousStatus: order.status,
    nextStatus: updatedOrder.status,
    source: 'payments.verify',
  }).catch(() => undefined);

  emitRestaurantEvent(order.restaurantId, {
    type: 'order.updated',
    userId: updatedOrder.userId,
    payload: buildOrderEventPayload(updatedOrder),
  });

  const response: ApiResponse = {
    success: true,
    message: computed.paymentStatus === 'COMPLETED' ? 'Payment verified successfully' : 'Partial payment verified successfully',
    data: {
      order: updatedOrder,
      paymentId: razorpay_payment_id,
    },
  };

  return res.json(response);
}));

// POST /api/payments/refund
router.post('/refund', authenticate, requireRestaurant, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { orderId, amount, reason } = refundPaymentSchema.parse(req.body);

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: req.user!.id,
      restaurantId: req.restaurant!.id,
      paymentStatus: {
        in: ['COMPLETED', 'PARTIALLY_PAID'],
      },
    },
  });

  if (!order) {
    throw new AppError('Order not found or payment not completed', 404);
  }

  if (!order.paymentTransactionId) {
    throw new AppError('No payment transaction ID found for this order', 400);
  }

  const refundAmountPaise = amount ? Math.round(amount * 100) : order.paidAmountPaise;

  const provider = getPaymentProvider(order.paymentProvider as PaymentProviderType);
  const refund = await provider.refund(
    order.paymentTransactionId,
    refundAmountPaise,
    reason || 'Customer requested refund'
  );

  const nextPaid = Math.max(order.paidAmountPaise - refundAmountPaise, 0);
  const computed = computeDueAndStatus(order.totalPaise, nextPaid);

  const [updatedOrder] = await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: nextPaid === 0 ? 'REFUNDED' : computed.paymentStatus,
        paidAmountPaise: computed.paidAmountPaise,
        dueAmountPaise: computed.dueAmountPaise,
        status: nextPaid === 0 ? 'CANCELLED' : order.status,
        updatedAt: new Date(),
      },
    }),
    prisma.payment.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        restaurantId: order.restaurantId,
        method: 'ONLINE',
        provider: order.paymentProvider,
        amountPaise: -refundAmountPaise,
        status: 'REFUNDED',
        providerPaymentId: refund.id,
        notes: reason || 'Refund',
      },
    }),
  ]);

  await safeCreateAuditLog({
    actorUserId: req.user!.id,
    restaurantId: order.restaurantId,
    action: 'PAYMENT_REFUNDED',
    entityType: 'order',
    entityId: order.id,
    metadata: {
      refundAmountPaise,
      refundId: refund.id,
      reason,
    },
  });

  await syncKOTTicketFromOrderStatus({
    restaurantId: updatedOrder.restaurantId,
    orderId: updatedOrder.id,
    orderStatus: updatedOrder.status,
    changedByUserId: req.user?.id,
    note: `Synced from payment refund (${updatedOrder.status})`,
    createIfMissing: !updatedOrder.isDelivery,
    skipForDeliveryOrder: Boolean(updatedOrder.isDelivery),
  });
  await notifyOrderStatusChange({
    orderId: updatedOrder.id,
    previousStatus: order.status,
    nextStatus: updatedOrder.status,
    source: 'payments.refund',
  }).catch(() => undefined);

  emitRestaurantEvent(order.restaurantId, {
    type: 'order.updated',
    userId: order.userId,
    payload: buildOrderEventPayload(updatedOrder),
  });

  logger.info('Payment refunded successfully', {
    orderId,
    refundId: refund.id,
    amount: refund.amount,
    userId: req.user!.id,
  });

  const response: ApiResponse = {
    success: true,
    message: 'Payment refunded successfully',
    data: {
      refundId: refund.id,
      amount: refund.amount ? refund.amount / 100 : 0,
      status: refund.status,
    },
  };

  return res.json(response);
}));

// GET /api/payments/status/:orderId
router.get('/status/:orderId', authenticate, requireRestaurant, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { orderId } = req.params;

  if (!orderId) {
    throw new AppError('Order ID is required', 400);
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: req.user!.id,
      restaurantId: req.restaurant!.id,
    },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paymentId: true,
      totalPaise: true,
      paidAmountPaise: true,
      dueAmountPaise: true,
      createdAt: true,
      updatedAt: true,
      payments: {
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          amountPaise: true,
          method: true,
          provider: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  const response: ApiResponse = {
    success: true,
    data: { order },
  };

  res.json(response);
}));

// POST /api/payments/cash/confirm
router.post('/cash/confirm', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const idempotency = await ensureMutationIdempotency(req, `payments:cash-confirm:${req.restaurant!.id}`);
  if (!idempotency.ok) {
    throw new AppError(idempotency.error, idempotency.statusCode);
  }

  const payload = cashConfirmSchema.parse(req.body);

  const order = await prisma.order.findFirst({
    where: {
      id: payload.orderId,
      restaurantId: req.restaurant!.id,
      paymentProvider: 'CASH',
      paymentStatus: {
        in: ['PENDING', 'PROCESSING', 'FAILED', 'PARTIALLY_PAID'],
      },
    },
  });

  if (!order) {
    throw new AppError('Cash order not found or already fully paid', 404);
  }
  const versionCheck = ensureOrderVersion(req, order.updatedAt);
  if (!versionCheck.ok) {
    throw new AppError(versionCheck.error, versionCheck.statusCode);
  }

  const amountToAdd = Math.min(payload.amountPaise ?? order.dueAmountPaise, order.dueAmountPaise);
  const nextPaid = order.paidAmountPaise + amountToAdd;
  const computed = computeDueAndStatus(order.totalPaise, nextPaid);

  const [, updatedOrder] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: computed.paymentStatus,
        paidAmountPaise: computed.paidAmountPaise,
        dueAmountPaise: computed.dueAmountPaise,
        status: computed.dueAmountPaise === 0 && order.status === 'PENDING' ? 'CONFIRMED' : order.status,
        paymentTransactionId: computed.dueAmountPaise === 0 ? `cash-${Date.now()}` : order.paymentTransactionId,
        updatedAt: new Date(),
      },
    }),
    prisma.payment.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        restaurantId: order.restaurantId,
        method: 'CASH',
        provider: 'CASH',
        amountPaise: amountToAdd,
        status: computed.paymentStatus,
        notes: 'Cash payment confirmed by restaurant admin',
      },
    }),
  ]);

  await safeCreateAuditLog({
    actorUserId: req.user!.id,
    restaurantId: order.restaurantId,
    action: 'CASH_PAYMENT_CONFIRMED',
    entityType: 'order',
    entityId: order.id,
    metadata: {
      amountToAdd,
      paymentStatus: computed.paymentStatus,
      dueAmountPaise: computed.dueAmountPaise,
    },
  });

  await ensureInvoiceAndEarningForFullyPaidOrder(order.id);
  await processOrderCompletionNotifications(order.id).catch((error) => {
    logger.error('Order completion notification pipeline failed after cash confirm', {
      orderId: order.id,
      message: error instanceof Error ? error.message : String(error),
    });
  });

  await syncKOTTicketFromOrderStatus({
    restaurantId: updatedOrder.restaurantId,
    orderId: updatedOrder.id,
    orderStatus: updatedOrder.status,
    changedByUserId: req.user?.id,
    note: `Synced from cash confirmation (${updatedOrder.status})`,
    createIfMissing: !updatedOrder.isDelivery,
    skipForDeliveryOrder: Boolean(updatedOrder.isDelivery),
  });
  emitAcceptedNotificationIfNeeded(order.status, updatedOrder);
  await notifyOrderStatusChange({
    orderId: updatedOrder.id,
    previousStatus: order.status,
    nextStatus: updatedOrder.status,
    source: 'payments.cash-confirm',
  }).catch(() => undefined);

  emitRestaurantEvent(order.restaurantId, {
    type: 'order.updated',
    userId: updatedOrder.userId,
    payload: buildOrderEventPayload(updatedOrder),
  });

  return res.json({
    success: true,
    message: computed.paymentStatus === 'COMPLETED' ? 'Cash payment fully confirmed' : 'Cash partial payment confirmed',
    data: {
      order: updatedOrder,
    },
  });
}));

// PUT /api/payments/status
router.put('/status', authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const idempotency = await ensureMutationIdempotency(req, `payments:update-status:${req.restaurant!.id}`);
  if (!idempotency.ok) {
    throw new AppError(idempotency.error, idempotency.statusCode);
  }

  const payload = updatePaymentStatusSchema.parse(req.body);

  const order = await prisma.order.findFirst({
    where: {
      id: payload.orderId,
      restaurantId: req.restaurant!.id,
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }
  const versionCheck = ensureOrderVersion(req, order.updatedAt);
  if (!versionCheck.ok) {
    throw new AppError(versionCheck.error, versionCheck.statusCode);
  }

  const totalPaise = order.totalPaise;
  let paidAmountPaise = order.paidAmountPaise;

  if (payload.paymentStatus === 'COMPLETED') {
    paidAmountPaise = totalPaise;
  } else if (payload.paymentStatus === 'PARTIALLY_PAID') {
    if (typeof payload.paidAmountPaise !== 'number') {
      throw new AppError('paidAmountPaise is required for PARTIALLY_PAID', 400);
    }
    if (payload.paidAmountPaise <= 0 || payload.paidAmountPaise >= totalPaise) {
      throw new AppError('paidAmountPaise must be between 1 and total-1 for PARTIALLY_PAID', 400);
    }
    paidAmountPaise = payload.paidAmountPaise;
  } else if (payload.paymentStatus === 'REFUNDED') {
    paidAmountPaise = 0;
  } else if (typeof payload.paidAmountPaise === 'number') {
    paidAmountPaise = Math.max(0, Math.min(payload.paidAmountPaise, totalPaise));
  } else if (payload.paymentStatus === 'FAILED') {
    paidAmountPaise = 0;
  }

  const computed = computeDueAndStatus(totalPaise, paidAmountPaise);
  const shouldAutoConfirm =
    computed.dueAmountPaise === 0 && order.status === 'PENDING';

  const [updatedOrder] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: payload.paymentStatus as any,
        paidAmountPaise: computed.paidAmountPaise,
        dueAmountPaise: computed.dueAmountPaise,
        status: shouldAutoConfirm ? 'CONFIRMED' : order.status,
        updatedAt: new Date(),
      },
    }),
  ]);

  await safeCreateAuditLog({
    actorUserId: req.user!.id,
    restaurantId: order.restaurantId,
    action: 'PAYMENT_STATUS_UPDATED',
    entityType: 'order',
    entityId: order.id,
    metadata: {
      paymentStatus: payload.paymentStatus,
      paidAmountPaise: computed.paidAmountPaise,
      dueAmountPaise: computed.dueAmountPaise,
    },
  });

  if (payload.paymentStatus === 'COMPLETED') {
    await ensureInvoiceAndEarningForFullyPaidOrder(order.id);
    await processOrderCompletionNotifications(order.id).catch((error) => {
      logger.error('Order completion notification pipeline failed after payment status update', {
        orderId: order.id,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }

  await syncKOTTicketFromOrderStatus({
    restaurantId: updatedOrder.restaurantId,
    orderId: updatedOrder.id,
    orderStatus: updatedOrder.status,
    changedByUserId: req.user?.id,
    note: `Synced from payment status ${payload.paymentStatus}`,
    createIfMissing: !updatedOrder.isDelivery,
    skipForDeliveryOrder: Boolean(updatedOrder.isDelivery),
  });
  emitAcceptedNotificationIfNeeded(order.status, updatedOrder);
  await notifyOrderStatusChange({
    orderId: updatedOrder.id,
    previousStatus: order.status,
    nextStatus: updatedOrder.status,
    source: 'payments.update-status',
  }).catch(() => undefined);

  emitRestaurantEvent(order.restaurantId, {
    type: 'order.updated',
    userId: updatedOrder.userId,
    payload: buildOrderEventPayload(updatedOrder),
  });

  return res.json({
    success: true,
    message: 'Payment status updated',
    data: { order: updatedOrder },
  });
}));

export default router;
