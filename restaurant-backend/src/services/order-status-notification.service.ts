import { prisma } from '@/config/database';
import { sendOrderStatusUpdateEmail } from '@/lib/email';
import { sendOrderStatusUpdateSMS } from '@/lib/sms';
import { resolveOrderPlacementContact } from '@/services/order-contact.service';
import { logger } from '@/utils/logger';

const withRetries = async <T>(label: string, fn: () => Promise<T>, retries = 2): Promise<T> => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt > retries) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  throw new Error(`${label} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
};

const logDeliveryResult = (input: {
  channel: 'email' | 'sms';
  status: 'success' | 'failure' | 'skipped';
  orderId: string;
  source: string;
  target: string;
  reason?: string;
  errorMessage?: string;
  startedAt: string;
}) => {
  const payload = {
    channel: input.channel,
    status: input.status,
    orderId: input.orderId,
    source: input.source,
    target: input.target,
    reason: input.reason,
    errorMessage: input.errorMessage,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
  };
  if (input.status === 'failure') {
    logger.error('ORDER_STATUS_DELIVERY', payload);
    return;
  }
  logger.info('ORDER_STATUS_DELIVERY', payload);
};

export const notifyOrderStatusChange = async (input: {
  orderId: string;
  previousStatus: string;
  nextStatus: string;
  source: string;
}) => {
  if (!input.orderId || input.previousStatus === input.nextStatus) {
    return { emailSent: false, smsSent: false };
  }
  const isInitialConfirmation = input.previousStatus === 'PENDING' && input.nextStatus === 'CONFIRMED';
  if (!isInitialConfirmation) {
    return { emailSent: false, smsSent: false };
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      restaurant: {
        select: {
          name: true,
        },
      },
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!order) {
    return { emailSent: false, smsSent: false };
  }

  const placementContact = resolveOrderPlacementContact(order);
  const payload = {
    customerName: placementContact.name || 'Guest',
    orderId: order.id,
    previousStatus: input.previousStatus,
    nextStatus: input.nextStatus,
    restaurantName: order.restaurant?.name || 'Restaurant',
  };

  let emailSent = false;
  let smsSent = false;

  if (placementContact.email) {
    const startedAt = new Date().toISOString();
    try {
      emailSent = await withRetries('order-status-email-send', async () =>
        sendOrderStatusUpdateEmail({
          to: placementContact.email,
          ...payload,
        })
      );
      logDeliveryResult({
        channel: 'email',
        status: emailSent ? 'success' : 'failure',
        orderId: order.id,
        source: input.source,
        target: placementContact.email,
        ...(emailSent ? {} : { reason: 'provider_returned_false' }),
        startedAt,
      });
    } catch (error) {
      logDeliveryResult({
        channel: 'email',
        status: 'failure',
        orderId: order.id,
        source: input.source,
        target: placementContact.email,
        errorMessage: error instanceof Error ? error.message : String(error),
        startedAt,
      });
    }
  } else {
    logDeliveryResult({
      channel: 'email',
      status: 'skipped',
      orderId: order.id,
      source: input.source,
      target: '',
      reason: 'missing_order_placement_email',
      startedAt: new Date().toISOString(),
    });
  }

  if (placementContact.phone) {
    const startedAt = new Date().toISOString();
    try {
      smsSent = await withRetries('order-status-sms-send', async () =>
        sendOrderStatusUpdateSMS(placementContact.phone, payload)
      );
      logDeliveryResult({
        channel: 'sms',
        status: smsSent ? 'success' : 'failure',
        orderId: order.id,
        source: input.source,
        target: placementContact.phone,
        ...(smsSent ? {} : { reason: 'provider_returned_false' }),
        startedAt,
      });
    } catch (error) {
      logDeliveryResult({
        channel: 'sms',
        status: 'failure',
        orderId: order.id,
        source: input.source,
        target: placementContact.phone,
        errorMessage: error instanceof Error ? error.message : String(error),
        startedAt,
      });
    }
  } else {
    logDeliveryResult({
      channel: 'sms',
      status: 'skipped',
      orderId: order.id,
      source: input.source,
      target: '',
      reason: 'missing_order_placement_phone',
      startedAt: new Date().toISOString(),
    });
  }

  logger.info('Order status customer notifications processed', {
    orderId: order.id,
    source: input.source,
    previousStatus: input.previousStatus,
    nextStatus: input.nextStatus,
    emailSent,
    smsSent,
    hasPlacedEmail: Boolean(placementContact.email),
    hasPlacedPhone: Boolean(placementContact.phone),
  });

  return { emailSent, smsSent };
};
