import { prisma } from '@/config/database';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { sendOrderConfirmationSMS } from '@/lib/sms';
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
      restaurant: { select: { name: true } },
      user: { select: { name: true } },
      table: { select: { number: true } },
    },
  });

  if (!order) {
    return { emailSent: false, smsSent: false };
  }

  const placementContact = resolveOrderPlacementContact(order);

  let emailSent = false;
  let smsSent = false;

  if (!placementContact.email) {
    logger.info('Order confirmation email skipped', {
      orderId: order.id,
      source: input.source,
      reason: 'missing_order_placement_email',
    });
  }

  try {
    if (placementContact.email) {
      emailSent = await withRetries('order-confirmation-email-send', async () =>
        sendOrderConfirmationEmail({
          to: placementContact.email,
          customerName: placementContact.name || 'Guest',
          orderId: order.id,
          restaurantName: order.restaurant?.name || 'Restaurant',
        })
      );
    }
  } catch (error) {
    logger.error('Order confirmation email failed', {
      orderId: order.id,
      source: input.source,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!placementContact.phone) {
    logger.info('Order confirmation sms skipped', {
      orderId: order.id,
      source: input.source,
      reason: 'missing_order_placement_phone',
    });
  }

  try {
    if (placementContact.phone) {
      smsSent = await withRetries('order-confirmation-sms-send', async () =>
        sendOrderConfirmationSMS(placementContact.phone, {
          customerName: placementContact.name || 'Guest',
          orderId: order.id.slice(0, 8).toUpperCase(),
          total: order.totalPaise / 100,
          tableNumber: order.table?.number || 0,
          restaurantName: order.restaurant?.name || 'Restaurant',
        })
      );
    }
  } catch (error) {
    logger.error('Order confirmation sms failed', {
      orderId: order.id,
      source: input.source,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  logger.info('Order status notification processed', {
    orderId: order.id,
    source: input.source,
    previousStatus: input.previousStatus,
    nextStatus: input.nextStatus,
    emailSent,
    smsSent,
  });

  return { emailSent, smsSent };
};
