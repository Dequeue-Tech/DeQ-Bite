import 'dotenv/config';
import { Worker } from 'bullmq';
import { createBullmqConnection } from '@/queues/bullmq-connection';
import { ORDER_COMPLETION_QUEUE_NAME } from '@/queues/orderCompletion.constants';
import { connectDatabase, disconnectDatabase } from '@/config/database';
import { processOrderCompletionNotifications } from '@/services/order-completion.service';
import { logger } from '@/utils/logger';

const run = async () => {
  await connectDatabase();

  const connection = createBullmqConnection();

  const worker = new Worker(
    ORDER_COMPLETION_QUEUE_NAME,
    async (job) => {
      const { orderId } = job.data as { orderId: string };
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 1;

      logger.info('ORDER_COMPLETION_JOB_STARTED', {
        orderId,
        jobId: job.id,
        attemptsMade,
        maxAttempts,
      });

      try {
        await processOrderCompletionNotifications(orderId);
        logger.info('ORDER_COMPLETION_JOB_COMPLETED', {
          orderId,
          jobId: job.id,
          attemptsMade,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('ORDER_COMPLETION_JOB_ERROR', {
          orderId,
          jobId: job.id,
          attemptsMade,
          maxAttempts,
          willRetry: attemptsMade + 1 < maxAttempts,
          message,
        });
        throw error;
      }
    },
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on('error', (error) => {
    logger.error('ORDER_COMPLETION_WORKER_RUNTIME_ERROR', {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  worker.on('failed', (job, err) => {
    if (!job) {
      return;
    }
    const data = job.data as { orderId?: string };
    logger.error('ORDER_COMPLETION_JOB_FAILED_FINAL', {
      orderId: data.orderId,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
      message: err instanceof Error ? err.message : String(err),
    });
  });

  logger.info('ORDER_COMPLETION_WORKER_READY', {
    queue: ORDER_COMPLETION_QUEUE_NAME,
    concurrency: 1,
  });

  const shutdown = async (signal: string) => {
    logger.info('ORDER_COMPLETION_WORKER_SHUTDOWN', { signal });
    await worker.close();
    await connection.quit();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
};

void run().catch((error) => {
  logger.error('ORDER_COMPLETION_WORKER_BOOTSTRAP_FAILED', {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
