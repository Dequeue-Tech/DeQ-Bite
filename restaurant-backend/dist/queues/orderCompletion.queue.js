"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueOrderCompletionJob = void 0;
const bullmq_1 = require("bullmq");
const bullmq_connection_1 = require("../queues/bullmq-connection");
const orderCompletion_constants_1 = require("../queues/orderCompletion.constants");
const order_completion_service_1 = require("../services/order-completion.service");
const logger_1 = require("../utils/logger");
let orderCompletionQueue = null;
const getOrderCompletionQueue = () => {
    if (!orderCompletionQueue) {
        orderCompletionQueue = new bullmq_1.Queue(orderCompletion_constants_1.ORDER_COMPLETION_QUEUE_NAME, {
            connection: (0, bullmq_connection_1.createBullmqConnection)(),
        });
    }
    return orderCompletionQueue;
};
const runDirectFallback = (orderId, reason) => {
    void (0, order_completion_service_1.processOrderCompletionNotifications)(orderId).catch((error) => {
        logger_1.logger.error('ORDER_COMPLETION_DIRECT_FALLBACK_FAILED', {
            orderId,
            reason,
            message: error instanceof Error ? error.message : String(error),
        });
    });
};
const enqueueOrderCompletionJob = async (orderId) => {
    if (!(0, bullmq_connection_1.isBullmqRedisConfigured)()) {
        logger_1.logger.warn('ORDER_COMPLETION_QUEUE_SKIPPED', {
            orderId,
            reason: 'redis_not_configured',
            hint: 'Set REDIS_URL or REDIS_HOST (and optional REDIS_PORT / REDIS_PASSWORD) to use BullMQ.',
        });
        runDirectFallback(orderId, 'redis_not_configured');
        return;
    }
    try {
        const queue = getOrderCompletionQueue();
        await queue.add('order-completion', { orderId }, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
        });
        logger_1.logger.info('ORDER_COMPLETION_JOB_ENQUEUED', { orderId });
    }
    catch (error) {
        logger_1.logger.error('ORDER_COMPLETION_ENQUEUE_FAILED', {
            orderId,
            message: error instanceof Error ? error.message : String(error),
        });
        runDirectFallback(orderId, 'enqueue_failed');
    }
};
exports.enqueueOrderCompletionJob = enqueueOrderCompletionJob;
//# sourceMappingURL=orderCompletion.queue.js.map