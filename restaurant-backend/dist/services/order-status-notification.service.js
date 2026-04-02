"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOrderStatusChange = void 0;
const database_1 = require("../config/database");
const email_1 = require("../lib/email");
const sms_1 = require("../lib/sms");
const order_contact_service_1 = require("../services/order-contact.service");
const logger_1 = require("../utils/logger");
const withRetries = async (label, fn, retries = 2) => {
    let attempt = 0;
    let lastError;
    while (attempt <= retries) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            attempt += 1;
            if (attempt > retries)
                break;
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        }
    }
    throw new Error(`${label} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
};
const logDeliveryResult = (input) => {
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
        logger_1.logger.error('ORDER_STATUS_DELIVERY', payload);
        return;
    }
    logger_1.logger.info('ORDER_STATUS_DELIVERY', payload);
};
const notifyOrderStatusChange = async (input) => {
    if (!input.orderId || input.previousStatus === input.nextStatus) {
        return { emailSent: false, smsSent: false };
    }
    if (input.nextStatus !== 'CONFIRMED') {
        return { emailSent: false, smsSent: false };
    }
    const order = await database_1.prisma.order.findUnique({
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
    const placementContact = (0, order_contact_service_1.resolveOrderPlacementContact)(order);
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
            emailSent = await withRetries('order-status-email-send', async () => (0, email_1.sendOrderStatusUpdateEmail)({
                to: placementContact.email,
                ...payload,
            }));
            logDeliveryResult({
                channel: 'email',
                status: emailSent ? 'success' : 'failure',
                orderId: order.id,
                source: input.source,
                target: placementContact.email,
                ...(emailSent ? {} : { reason: 'provider_returned_false' }),
                startedAt,
            });
        }
        catch (error) {
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
    }
    else {
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
            smsSent = await withRetries('order-status-sms-send', async () => (0, sms_1.sendOrderStatusUpdateSMS)(placementContact.phone, payload));
            logDeliveryResult({
                channel: 'sms',
                status: smsSent ? 'success' : 'failure',
                orderId: order.id,
                source: input.source,
                target: placementContact.phone,
                ...(smsSent ? {} : { reason: 'provider_returned_false' }),
                startedAt,
            });
        }
        catch (error) {
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
    }
    else {
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
    logger_1.logger.info('Order status customer notifications processed', {
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
exports.notifyOrderStatusChange = notifyOrderStatusChange;
//# sourceMappingURL=order-status-notification.service.js.map