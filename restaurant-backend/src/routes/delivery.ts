import { Router } from 'express';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';
import { emitRestaurantEvent, emitRoleScopedRestaurantEvent } from '@/utils/realtime';
import { sendSMS } from '@/lib/sms';
import {
  attachMarketplaceMetadataToOrders,
  attachMarketplaceOrderMetadata,
  extractMarketplaceOrderMetadata,
} from '@/modules/pos/marketplace-order-meta';
import { notifyOrderStatusChange } from '@/services/order-status-notification.service';
import { extractIdempotencyKey, claimIdempotencyKey } from '@/utils/idempotency';
import { extractExpectedUpdatedAt, hasVersionConflict } from '@/utils/order-lock';

const router = Router();
const TAX_RATE = 0.08;
const LEGACY_DELIVERY_META_PREFIX = '[DELIVERY_META]';
const staleWriteMessage = 'This order was just updated by someone else. Refreshing…';

type DeliveryStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

type DeliveryMeta = {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  landmark?: string;
  riderName?: string;
  riderPhone?: string;
  deliveryStatus: DeliveryStatus;
};

type RiderAvailability = 'ONLINE' | 'BUSY' | 'OFFLINE';

type CreateOrderItemInput = {
  menuItemId: string;
  quantity: number;
  notes?: string;
};

type MenuLookupItem = {
  id: string;
  name: string;
  pricePaise: number;
  available: boolean;
};

router.use(authenticate);
router.use(requireRestaurant);

const toInr = (paise: number) => (paise / 100).toFixed(2);

const normalizeCouponCode = (code: string) => code.trim().toUpperCase();

const calculateDiscountFromCoupon = (coupon: any, subtotalPaise: number) => {
  if (!coupon || !coupon.active) return 0;

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return 0;
  if (coupon.endsAt && coupon.endsAt < now) return 0;
  if (coupon.minOrderPaise && subtotalPaise < coupon.minOrderPaise) return 0;

  let discountPaise = 0;
  if (coupon.type === 'PERCENT') discountPaise = Math.floor((subtotalPaise * coupon.value) / 100);
  else discountPaise = coupon.value;

  if (coupon.maxDiscountPaise && discountPaise > coupon.maxDiscountPaise) {
    discountPaise = coupon.maxDiscountPaise;
  }

  return Math.min(discountPaise, subtotalPaise);
};

const applyCoupon = async (restaurantId: string, code: string, subtotalPaise: number) => {
  const normalizedCode = normalizeCouponCode(code);
  const coupon = await prisma.coupon.findUnique({
    where: {
      restaurantId_code: {
        restaurantId,
        code: normalizedCode,
      },
    },
  });

  if (!coupon || !coupon.active) {
    throw new Error('Invalid or inactive coupon code');
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new Error('Coupon is not active yet');
  if (coupon.endsAt && coupon.endsAt < now) throw new Error('Coupon has expired');
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) throw new Error('Coupon usage limit reached');
  if (coupon.minOrderPaise && subtotalPaise < coupon.minOrderPaise) throw new Error('Order total does not meet coupon minimum');

  const discountPaise = calculateDiscountFromCoupon(coupon, subtotalPaise);
  return { couponId: coupon.id, discountPaise };
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

const buildOrderEventPayload = (order: any) => ({
  order: {
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
    ...(order.items ? { items: order.items } : {}),
    ...(order.table ? { table: order.table } : {}),
    ...(order.user ? { user: order.user } : {}),
    ...(typeof order.subtotalPaise === 'number' ? { subtotalPaise: order.subtotalPaise } : {}),
    ...(typeof order.taxPaise === 'number' ? { taxPaise: order.taxPaise } : {}),
    ...(typeof order.discountPaise === 'number' ? { discountPaise: order.discountPaise } : {}),
    ...(() => {
      const metadata = extractMarketplaceOrderMetadata(order.specialInstructions);
      if (!metadata) return {};
      return {
        sourceSystem: metadata.sourceSystem,
        externalOrderId: metadata.externalOrderId,
      };
    })(),
  },
});

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

const parseLegacyDeliveryMeta = (specialInstructions?: string | null): DeliveryMeta | null => {
  if (!specialInstructions) return null;
  const idx = specialInstructions.lastIndexOf(LEGACY_DELIVERY_META_PREFIX);
  if (idx === -1) return null;
  const raw = specialInstructions.slice(idx + LEGACY_DELIVERY_META_PREFIX.length).trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeliveryMeta;
  } catch {
    return null;
  }
};

const mapDeliveryToOrderStatus = (deliveryStatus: DeliveryStatus) => {
  switch (deliveryStatus) {
    case 'PLACED':
      return 'PENDING';
    case 'CONFIRMED':
      return 'CONFIRMED';
    case 'PREPARING':
      return 'PREPARING';
    case 'OUT_FOR_DELIVERY':
      return 'READY';
    case 'DELIVERED':
      return 'COMPLETED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
};

const getOrderDeliveryMeta = (order: any): DeliveryMeta => {
  if (order.deliveryStatus && order.deliveryCustomerName && order.deliveryCustomerPhone && order.deliveryAddress) {
    return {
      customerName: order.deliveryCustomerName,
      customerPhone: order.deliveryCustomerPhone,
      deliveryAddress: order.deliveryAddress,
      ...(order.deliveryLandmark ? { landmark: order.deliveryLandmark } : {}),
      ...(order.deliveryRiderName ? { riderName: order.deliveryRiderName } : {}),
      ...(order.deliveryRiderPhone ? { riderPhone: order.deliveryRiderPhone } : {}),
      deliveryStatus: order.deliveryStatus as DeliveryStatus,
    };
  }

  const legacy = parseLegacyDeliveryMeta(order.specialInstructions);
  if (legacy) return legacy;

  return {
    customerName: 'Unknown',
    customerPhone: '',
    deliveryAddress: '',
    deliveryStatus: 'PLACED',
  };
};

const ensureDeliveryTable = async (restaurantId: string) => {
  const existing = await prisma.table.findFirst({
    where: {
      restaurantId,
      active: true,
      OR: [{ location: { equals: 'DELIVERY', mode: 'insensitive' } }, { location: { equals: 'Delivery', mode: 'insensitive' } }],
    },
  });
  if (existing) return existing;

  const maxNumberRow = await prisma.table.findFirst({
    where: { restaurantId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });

  return prisma.table.create({
    data: {
      restaurantId,
      number: (maxNumberRow?.number || 0) + 1,
      capacity: 1,
      location: 'DELIVERY',
      active: true,
    },
  });
};

const notifyRestaurantOnOrderPlaced = async (
  restaurantId: string,
  payload: { orderId: string; customerName: string; totalPaise: number; customerPhone: string }
) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { phone: true },
    });
    if (!restaurant?.phone) return;

    await sendSMS({
      to: restaurant.phone,
      message: `New delivery order #${payload.orderId.slice(0, 8).toUpperCase()} from ${payload.customerName} (${payload.customerPhone}) for INR ${toInr(payload.totalPaise)}. Please approve in POS.`,
    });
  } catch {
    // Best effort
  }
};

const notifyOnDeliveryApproval = async (
  restaurantId: string,
  payload: { orderId: string; customerName: string; customerPhone: string; totalPaise: number }
) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, phone: true },
    });

    if (payload.customerPhone) {
      await sendSMS({
        to: payload.customerPhone,
        message: `Hi ${payload.customerName}, your delivery order #${payload.orderId.slice(0, 8).toUpperCase()} has been approved by ${restaurant?.name || 'the restaurant'}. Total INR ${toInr(payload.totalPaise)}.`,
      });
    }

    if (restaurant?.phone) {
      await sendSMS({
        to: restaurant.phone,
        message: `Delivery order #${payload.orderId.slice(0, 8).toUpperCase()} is approved and moved to CONFIRMED.`,
      });
    }
  } catch {
    // Best effort
  }
};

router.post('/orders', async (req: AuthenticatedRequest, res) => {
  try {
    const idempotency = await ensureMutationIdempotency(req, `delivery:create:${req.restaurant!.id}`);
    if (!idempotency.ok) {
      return res.status(idempotency.statusCode).json({ success: false, error: idempotency.error });
    }

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const {
      items,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      landmark,
      specialInstructions,
      paymentProvider,
      couponCode,
    } = req.body;

    if (!customerName || !customerPhone || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        error: 'customerName, customerPhone and deliveryAddress are required',
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Items array cannot be empty' });
    }

    const allowedProviders = ['RAZORPAY', 'PAYTM', 'PHONEPE', 'CASH'];
    const selectedProvider = paymentProvider || 'RAZORPAY';
    if (!allowedProviders.includes(selectedProvider)) {
      return res.status(400).json({ success: false, error: 'Invalid payment provider' });
    }
    if (selectedProvider === 'CASH' && !req.restaurant!.cashPaymentEnabled) {
      return res.status(400).json({ success: false, error: 'Cash payment is disabled by this restaurant' });
    }

    const deliveryTable = await ensureDeliveryTable(req.restaurant!.id);
    const requestItems = items as CreateOrderItemInput[];
    const itemIds = requestItems.map((item) => item?.menuItemId).filter(Boolean);
    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId: req.restaurant!.id, id: { in: itemIds } },
      select: { id: true, name: true, pricePaise: true, available: true },
    });
    const menuById = new Map<string, MenuLookupItem>(menuItems.map((item: MenuLookupItem) => [item.id, item]));

    let subtotalPaise = 0;
    const orderItemsData: Array<{ menuItemId: string; quantity: number; pricePaise: number; notes: string }> = [];

    for (const [index, item] of requestItems.entries()) {
      if (!item?.menuItemId || typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: `Each item must include menuItemId and positive integer quantity. Invalid item at position ${index + 1}.`,
        });
      }

      const menuItem = menuById.get(item.menuItemId);
      if (!menuItem) {
        return res.status(400).json({ success: false, error: `Menu item with id ${item.menuItemId} not found` });
      }
      if (!menuItem.available) {
        return res.status(400).json({ success: false, error: `Menu item "${menuItem.name}" is unavailable` });
      }

      subtotalPaise += menuItem.pricePaise * item.quantity;
      orderItemsData.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        pricePaise: menuItem.pricePaise,
        notes: item.notes || '',
      });
    }

    let discountPaise = 0;
    let appliedCouponId: string | null = null;
    if (couponCode) {
      try {
        const couponResult = await applyCoupon(req.restaurant!.id, couponCode, subtotalPaise);
        discountPaise = couponResult.discountPaise;
        appliedCouponId = couponResult.couponId;
      } catch (couponError: any) {
        return res.status(400).json({ success: false, error: couponError?.message || 'Invalid coupon code' });
      }
    }

    const taxablePaise = Math.max(subtotalPaise - discountPaise, 0);
    const taxPaise = Math.round(taxablePaise * TAX_RATE);
    const totalPaise = taxablePaise + taxPaise;
    const deliveryMeta: DeliveryMeta = {
      customerName: String(customerName).trim(),
      customerPhone: String(customerPhone).trim(),
      deliveryAddress: String(deliveryAddress).trim(),
      ...(landmark ? { landmark: String(landmark).trim() } : {}),
      deliveryStatus: 'PLACED',
    };

    const createOrderData = {
      userId,
      restaurantId: req.restaurant!.id,
      tableId: deliveryTable.id,
      isDelivery: true,
      deliveryStatus: deliveryMeta.deliveryStatus as any,
      deliveryCustomerName: deliveryMeta.customerName,
      deliveryCustomerPhone: deliveryMeta.customerPhone,
      deliveryAddress: deliveryMeta.deliveryAddress,
      deliveryLandmark: deliveryMeta.landmark || null,
      subtotalPaise,
      taxPaise,
      totalPaise,
      discountPaise,
      couponId: appliedCouponId,
      status: 'PENDING',
      paymentStatus: selectedProvider === 'CASH' ? 'PROCESSING' : 'PENDING',
      paymentProvider: selectedProvider,
      paidAmountPaise: 0,
      dueAmountPaise: totalPaise,
      paymentCollectionTiming: req.restaurant!.paymentCollectionTiming,
      specialInstructions: [
        typeof specialInstructions === 'string' ? specialInstructions.trim() : '',
        typeof customerEmail === 'string' && customerEmail.trim()
          ? `[DELIVERY_EMAIL]${customerEmail.trim().toLowerCase()}`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      items: {
        create: orderItemsData,
      },
    };

    const order = appliedCouponId
      ? (await prisma.$transaction([
          prisma.coupon.update({
            where: { id: appliedCouponId },
            data: { usageCount: { increment: 1 } },
          }),
          prisma.order.create({
            data: createOrderData,
            include: {
              items: { include: { menuItem: true } },
              table: true,
              user: { select: { id: true, name: true, email: true } },
            },
          }),
        ]))[1]
      : await prisma.order.create({
          data: createOrderData,
          include: {
            items: { include: { menuItem: true } },
            table: true,
            user: { select: { id: true, name: true, email: true } },
          },
        });

    emitRestaurantEvent(order.restaurantId, {
      type: 'order.created',
      userId: order.userId,
      payload: buildOrderEventPayload(order),
    });

    await notifyRestaurantOnOrderPlaced(order.restaurantId, {
      orderId: order.id,
      customerName: deliveryMeta.customerName,
      totalPaise: order.totalPaise,
      customerPhone: deliveryMeta.customerPhone,
    });

    return res.status(201).json({
      success: true,
      data: attachMarketplaceOrderMetadata({ ...order, deliveryMeta }),
      message: 'Delivery order created successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to create delivery order' });
  }
});

router.get('/orders/restaurant/all', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const updatedAfterRaw = typeof req.query['updatedAfter'] === 'string' ? req.query['updatedAfter'] : '';
    const updatedAfter = updatedAfterRaw ? new Date(updatedAfterRaw) : null;
    const hasValidUpdatedAfter = Boolean(updatedAfter && !Number.isNaN(updatedAfter.getTime()));
    const orders = await prisma.order.findMany({
      where: {
        restaurantId: req.restaurant!.id,
        isDelivery: true,
        ...(hasValidUpdatedAfter ? { updatedAt: { gt: updatedAfter! } } : {}),
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = attachMarketplaceMetadataToOrders(
      orders.map((order: any) => ({ ...order, deliveryMeta: getOrderDeliveryMeta(order) }))
    );
    return res.json({
      success: true,
      data: enriched,
      message: 'Delivery orders fetched successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch delivery orders' });
  }
});

router.get('/orders/my', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const updatedAfterRaw = typeof req.query['updatedAfter'] === 'string' ? req.query['updatedAfter'] : '';
    const updatedAfter = updatedAfterRaw ? new Date(updatedAfterRaw) : null;
    const hasValidUpdatedAfter = Boolean(updatedAfter && !Number.isNaN(updatedAfter.getTime()));

    const orders = await prisma.order.findMany({
      where: {
        userId: req.user.id,
        restaurantId: req.restaurant!.id,
        isDelivery: true,
        ...(hasValidUpdatedAfter ? { updatedAt: { gt: updatedAfter! } } : {}),
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = attachMarketplaceMetadataToOrders(
      orders.map((order: any) => ({ ...order, deliveryMeta: getOrderDeliveryMeta(order) }))
    );
    return res.json({
      success: true,
      data: enriched,
      message: 'Customer delivery orders fetched successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch your delivery orders' });
  }
});

router.get('/riders', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const branchId = typeof req.query['branchId'] === 'string' ? req.query['branchId'].trim() : '';
    const riders = await prisma.deliveryRider.findMany({
      where: {
        restaurantId: req.restaurant!.id,
        active: true,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: [{ availability: 'asc' }, { createdAt: 'desc' }],
    });

    return res.json({
      success: true,
      data: riders,
      message: 'Riders fetched successfully',
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch riders' });
  }
});

router.post('/riders', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const idempotency = await ensureMutationIdempotency(req, `delivery:create-rider:${req.restaurant!.id}`);
    if (!idempotency.ok) {
      return res.status(idempotency.statusCode).json({ success: false, error: idempotency.error });
    }

    const {
      name,
      phone,
      vehicleType,
      branchId,
      availability,
    } = req.body as {
      name?: string;
      phone?: string;
      vehicleType?: string;
      branchId?: string;
      availability?: RiderAvailability;
    };

    if (!name?.trim() || !phone?.trim() || !vehicleType?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'name, phone and vehicleType are required',
      });
    }

    const rider = await prisma.deliveryRider.create({
      data: {
        restaurantId: req.restaurant!.id,
        name: name.trim(),
        phone: phone.trim(),
        vehicleType: vehicleType.trim(),
        branchId: branchId?.trim() || null,
        availability: availability || 'ONLINE',
      },
    });

    emitRestaurantEvent(req.restaurant!.id, {
      type: 'rider.pool.updated',
      payload: { rider },
    });

    return res.status(201).json({
      success: true,
      data: rider,
      message: 'Rider created successfully',
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to create rider' });
  }
});

router.put('/riders/:id/status', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const riderId = req.params['id'] as string;
    const { availability } = req.body as { availability?: RiderAvailability };
    if (!riderId) {
      return res.status(400).json({ success: false, error: 'Rider ID is required' });
    }
    if (!availability || !['ONLINE', 'BUSY', 'OFFLINE'].includes(availability)) {
      return res.status(400).json({ success: false, error: 'Valid availability is required' });
    }

    const rider = await prisma.deliveryRider.findFirst({
      where: {
        id: riderId,
        restaurantId: req.restaurant!.id,
        active: true,
      },
    });
    if (!rider) {
      return res.status(404).json({ success: false, error: 'Rider not found' });
    }

    const updated = await prisma.deliveryRider.update({
      where: { id: rider.id },
      data: { availability },
    });

    emitRestaurantEvent(req.restaurant!.id, {
      type: 'rider.pool.updated',
      payload: { rider: updated },
    });

    return res.json({
      success: true,
      data: updated,
      message: 'Rider status updated',
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to update rider status' });
  }
});

router.put('/orders/:id/assign-rider', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const idempotency = await ensureMutationIdempotency(req, `delivery:assign-rider:${req.restaurant!.id}`);
    if (!idempotency.ok) {
      return res.status(idempotency.statusCode).json({ success: false, error: idempotency.error });
    }

    const { id } = req.params;
    const { riderName, riderPhone, riderId, branchId } = req.body as {
      riderName?: string;
      riderPhone?: string;
      riderId?: string;
      branchId?: string;
    };

    if (!id) return res.status(400).json({ success: false, error: 'Order ID is required' });

    const existingOrder = await prisma.order.findFirst({
      where: {
        id,
        restaurantId: req.restaurant!.id,
        isDelivery: true,
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!existingOrder) return res.status(404).json({ success: false, error: 'Delivery order not found' });
    const versionCheck = ensureOrderVersion(req, existingOrder.updatedAt);
    if (!versionCheck.ok) {
      return res.status(versionCheck.statusCode).json({ success: false, error: versionCheck.error });
    }

    let resolvedRiderName = riderName?.trim() || '';
    let resolvedRiderPhone = riderPhone?.trim() || '';
    let assignedRiderId: string | null = null;

    if (riderId?.trim()) {
      const rider = await prisma.deliveryRider.findFirst({
        where: {
          id: riderId.trim(),
          restaurantId: req.restaurant!.id,
          active: true,
          ...(branchId?.trim() ? { branchId: branchId.trim() } : {}),
        },
      });
      if (!rider) {
        return res.status(404).json({ success: false, error: 'Selected rider not found for this restaurant' });
      }
      resolvedRiderName = rider.name;
      resolvedRiderPhone = rider.phone;
      assignedRiderId = rider.id;
      await prisma.deliveryRider.update({
        where: { id: rider.id },
        data: { availability: 'BUSY' },
      });
    }

    if (!resolvedRiderName || !resolvedRiderPhone) {
      return res.status(400).json({ success: false, error: 'riderId or riderName + riderPhone are required' });
    }

    const currentDeliveryStatus = (existingOrder.deliveryStatus as DeliveryStatus | null) || 'PLACED';
    const nextDeliveryStatus: DeliveryStatus = currentDeliveryStatus === 'PLACED' ? 'CONFIRMED' : currentDeliveryStatus;

    const updated = await prisma.order.update({
      where: { id: existingOrder.id },
      data: {
        deliveryRiderName: resolvedRiderName,
        deliveryRiderPhone: resolvedRiderPhone,
        deliveryStatus: nextDeliveryStatus as any,
        deliveryApprovedAt: nextDeliveryStatus === 'CONFIRMED' ? new Date() : existingOrder.deliveryApprovedAt,
        status: mapDeliveryToOrderStatus(nextDeliveryStatus) as any,
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    emitAcceptedNotificationIfNeeded(existingOrder.status, updated);
    await notifyOrderStatusChange({
      orderId: updated.id,
      previousStatus: existingOrder.status,
      nextStatus: updated.status,
      source: 'delivery.assign-rider',
    }).catch(() => undefined);

    emitRestaurantEvent(updated.restaurantId, {
      type: 'order.updated',
      userId: updated.userId,
      payload: buildOrderEventPayload(updated),
    });
    emitRoleScopedRestaurantEvent(
      updated.restaurantId,
      {
        type: 'rider.assigned',
        payload: {
          orderId: updated.id,
          order_id: updated.id,
          riderId: assignedRiderId,
          riderName: resolvedRiderName,
          riderPhone: resolvedRiderPhone,
          assignedAt: new Date().toISOString(),
        },
      },
      ['rider']
    );

    const deliveryMeta = getOrderDeliveryMeta(updated);
    if (nextDeliveryStatus === 'CONFIRMED') {
      await notifyOnDeliveryApproval(updated.restaurantId, {
        orderId: updated.id,
        customerName: deliveryMeta.customerName,
        customerPhone: deliveryMeta.customerPhone,
        totalPaise: updated.totalPaise,
      });
    }

    return res.json({
      success: true,
      data: attachMarketplaceOrderMetadata({ ...updated, deliveryMeta }),
      message: 'Rider assigned successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to assign rider' });
  }
});

router.put('/orders/:id/status', authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'), async (req: AuthenticatedRequest, res) => {
  try {
    const idempotency = await ensureMutationIdempotency(req, `delivery:update-status:${req.restaurant!.id}`);
    if (!idempotency.ok) {
      return res.status(idempotency.statusCode).json({ success: false, error: idempotency.error });
    }

    const { id } = req.params;
    const { deliveryStatus } = req.body as { deliveryStatus?: DeliveryStatus };

    const allowed: DeliveryStatus[] = [
      'PLACED',
      'CONFIRMED',
      'PREPARING',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
    ];

    if (!id) return res.status(400).json({ success: false, error: 'Order ID is required' });
    if (!deliveryStatus || !allowed.includes(deliveryStatus)) {
      return res.status(400).json({ success: false, error: 'Valid deliveryStatus is required' });
    }

    const existingOrder = await prisma.order.findFirst({
      where: {
        id,
        restaurantId: req.restaurant!.id,
        isDelivery: true,
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!existingOrder) return res.status(404).json({ success: false, error: 'Delivery order not found' });
    const versionCheck = ensureOrderVersion(req, existingOrder.updatedAt);
    if (!versionCheck.ok) {
      return res.status(versionCheck.statusCode).json({ success: false, error: versionCheck.error });
    }

    const updated = await prisma.order.update({
      where: { id: existingOrder.id },
      data: {
        deliveryStatus: deliveryStatus as any,
        deliveryApprovedAt: deliveryStatus === 'CONFIRMED' ? (existingOrder.deliveryApprovedAt || new Date()) : existingOrder.deliveryApprovedAt,
        status: mapDeliveryToOrderStatus(deliveryStatus) as any,
        paymentStatus: deliveryStatus === 'DELIVERED' ? 'COMPLETED' : existingOrder.paymentStatus,
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    emitAcceptedNotificationIfNeeded(existingOrder.status, updated);
    await notifyOrderStatusChange({
      orderId: updated.id,
      previousStatus: existingOrder.status,
      nextStatus: updated.status,
      source: 'delivery.update-status',
    }).catch(() => undefined);

    if (updated.deliveryRiderPhone && ['DELIVERED', 'CANCELLED'].includes(deliveryStatus)) {
      await prisma.deliveryRider.updateMany({
        where: {
          restaurantId: req.restaurant!.id,
          phone: updated.deliveryRiderPhone,
          active: true,
        },
        data: { availability: 'ONLINE' },
      });
    }

    emitRestaurantEvent(updated.restaurantId, {
      type: 'order.updated',
      userId: updated.userId,
      payload: buildOrderEventPayload(updated),
    });

    const deliveryMeta = getOrderDeliveryMeta(updated);
    if (deliveryStatus === 'CONFIRMED') {
      await notifyOnDeliveryApproval(updated.restaurantId, {
        orderId: updated.id,
        customerName: deliveryMeta.customerName,
        customerPhone: deliveryMeta.customerPhone,
        totalPaise: updated.totalPaise,
      });
    }

    return res.json({
      success: true,
      data: attachMarketplaceOrderMetadata({ ...updated, deliveryMeta }),
      message: 'Delivery status updated successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update delivery status' });
  }
});

export default router;
