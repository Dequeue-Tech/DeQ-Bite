import { prisma } from '@/config/database';
import { sendOrderConfirmationEmail } from '@/lib/email';
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
    },
  });

  if (!order) {
    return { emailSent: false, smsSent: false };
  }

  const placementContact = resolveOrderPlacementContact(order);
  if (!placementContact.email) {
    logger.info('Order confirmation email skipped', {
      orderId: order.id,
      source: input.source,
      reason: 'missing_order_placement_email',
    });
    return { emailSent: false, smsSent: false };
  }

  let emailSent = false;
  try {
    emailSent = await withRetries('order-confirmation-email-send', async () =>
      sendOrderConfirmationEmail({
        to: placementContact.email,
        customerName: placementContact.name || 'Guest',
        orderId: order.id,
        restaurantName: order.restaurant?.name || 'Restaurant',
      })
    );
  } catch (error) {
    logger.error('Order confirmation email failed', {
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
    smsSent: false,
  });

  return { emailSent, smsSent: false };
};
