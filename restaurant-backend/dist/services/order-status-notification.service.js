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
        emailSent = await withRetries('order-status-email-send', async () => (0, email_1.sendOrderStatusUpdateEmail)({
            to: placementContact.email,
            ...payload,
        }));
    }
    if (placementContact.phone) {
        smsSent = await withRetries('order-status-sms-send', async () => (0, sms_1.sendOrderStatusUpdateSMS)(placementContact.phone, payload));
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