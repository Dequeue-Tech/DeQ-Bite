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

export const notifyOrderStatusChange = async (input: {
  orderId: string;
  previousStatus: string;
  nextStatus: string;
  source: string;
}) => {
  if (!input.orderId || input.previousStatus === input.nextStatus) {
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
    emailSent = await withRetries('order-status-email-send', async () =>
      sendOrderStatusUpdateEmail({
        to: placementContact.email,
        ...payload,
      })
    );
  }

  if (placementContact.phone) {
    smsSent = await withRetries('order-status-sms-send', async () =>
      sendOrderStatusUpdateSMS(placementContact.phone, payload)
    );
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
