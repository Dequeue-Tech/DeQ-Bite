"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bullmq_1 = require("bullmq");
const bullmq_connection_1 = require("../queues/bullmq-connection");
const orderCompletion_constants_1 = require("../queues/orderCompletion.constants");
const database_1 = require("../config/database");
const order_completion_service_1 = require("../services/order-completion.service");
const logger_1 = require("../utils/logger");
const run = async () => {
    await (0, database_1.connectDatabase)();
    const connection = (0, bullmq_connection_1.createBullmqConnection)();
    const worker = new bullmq_1.Worker(orderCompletion_constants_1.ORDER_COMPLETION_QUEUE_NAME, async (job) => {
        const { orderId } = job.data;
        const attemptsMade = job.attemptsMade;
        const maxAttempts = job.opts.attempts ?? 1;
        logger_1.logger.info('ORDER_COMPLETION_JOB_STARTED', {
            orderId,
            jobId: job.id,
            attemptsMade,
            maxAttempts,
        });
        try {
            await (0, order_completion_service_1.processOrderCompletionNotifications)(orderId);
            logger_1.logger.info('ORDER_COMPLETION_JOB_COMPLETED', {
                orderId,
                jobId: job.id,
                attemptsMade,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.logger.error('ORDER_COMPLETION_JOB_ERROR', {
                orderId,
                jobId: job.id,
                attemptsMade,
                maxAttempts,
                willRetry: attemptsMade + 1 < maxAttempts,
                message,
            });
            throw error;
        }
    }, {
        connection,
        concurrency: 1,
    });
    worker.on('error', (error) => {
        logger_1.logger.error('ORDER_COMPLETION_WORKER_RUNTIME_ERROR', {
            message: error instanceof Error ? error.message : String(error),
        });
    });
    worker.on('failed', (job, err) => {
        if (!job) {
            return;
        }
        const data = job.data;
        logger_1.logger.error('ORDER_COMPLETION_JOB_FAILED_FINAL', {
            orderId: data.orderId,
            jobId: job.id,
            attemptsMade: job.attemptsMade,
            message: err instanceof Error ? err.message : String(err),
        });
    });
    logger_1.logger.info('ORDER_COMPLETION_WORKER_READY', {
        queue: orderCompletion_constants_1.ORDER_COMPLETION_QUEUE_NAME,
        concurrency: 1,
    });
    const shutdown = async (signal) => {
        logger_1.logger.info('ORDER_COMPLETION_WORKER_SHUTDOWN', { signal });
        await worker.close();
        await connection.quit();
        await (0, database_1.disconnectDatabase)();
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
    logger_1.logger.error('ORDER_COMPLETION_WORKER_BOOTSTRAP_FAILED', {
        message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
});
//# sourceMappingURL=orderCompletion.worker.js.map