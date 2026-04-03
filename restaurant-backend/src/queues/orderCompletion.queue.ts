import { Queue } from 'bullmq';
import { createBullmqConnection, isBullmqRedisConfigured } from '@/queues/bullmq-connection';
import { ORDER_COMPLETION_QUEUE_NAME } from '@/queues/orderCompletion.constants';
import { processOrderCompletionNotifications } from '@/services/order-completion.service';
import { logger } from '@/utils/logger';

let orderCompletionQueue: Queue | null = null;

const getOrderCompletionQueue = (): Queue => {
  if (!orderCompletionQueue) {
    orderCompletionQueue = new Queue(ORDER_COMPLETION_QUEUE_NAME, {
      connection: createBullmqConnection(),
    });
  }
  return orderCompletionQueue;
};

const runDirectFallback = (orderId: string, reason: string) => {
  void processOrderCompletionNotifications(orderId).catch((error) => {
    logger.error('ORDER_COMPLETION_DIRECT_FALLBACK_FAILED', {
      orderId,
      reason,
      message: error instanceof Error ? error.message : String(error),
    });
  });
};

/**
 * Enqueues invoice/email/SMS completion work. Resolves after the job is queued (fast).
 * When Redis is not configured or enqueue fails, falls back to the previous fire-and-forget behavior.
 */
export const enqueueOrderCompletionJob = async (orderId: string): Promise<void> => {
  if (!isBullmqRedisConfigured()) {
    logger.warn('ORDER_COMPLETION_QUEUE_SKIPPED', {
      orderId,
      reason: 'redis_not_configured',
      hint: 'Set REDIS_URL or REDIS_HOST (and optional REDIS_PORT / REDIS_PASSWORD) to use BullMQ.',
    });
    runDirectFallback(orderId, 'redis_not_configured');
    return;
  }

  try {
    const queue = getOrderCompletionQueue();
    await queue.add(
      'order-completion',
      { orderId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      }
    );
    logger.info('ORDER_COMPLETION_JOB_ENQUEUED', { orderId });
  } catch (error) {
    logger.error('ORDER_COMPLETION_ENQUEUE_FAILED', {
      orderId,
      message: error instanceof Error ? error.message : String(error),
    });
    runDirectFallback(orderId, 'enqueue_failed');
  }
};
