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
    const isInitialConfirmation = input.previousStatus === 'PENDING' && input.nextStatus === 'CONFIRMED';
    if (!isInitialConfirmation) {
        return { emailSent: false, smsSent: false };
    }
    const order = await database_1.prisma.order.findUnique({
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
    const placementContact = (0, order_contact_service_1.resolveOrderPlacementContact)(order);
    let emailSent = false;
    let smsSent = false;
    if (!placementContact.email) {
        logger_1.logger.info('Order confirmation email skipped', {
            orderId: order.id,
            source: input.source,
            reason: 'missing_order_placement_email',
        });
    }
    try {
        if (placementContact.email) {
            emailSent = await withRetries('order-confirmation-email-send', async () => (0, email_1.sendOrderConfirmationEmail)({
                to: placementContact.email,
                customerName: placementContact.name || 'Guest',
                orderId: order.id,
                restaurantName: order.restaurant?.name || 'Restaurant',
            }));
        }
    }
    catch (error) {
        logger_1.logger.error('Order confirmation email failed', {
            orderId: order.id,
            source: input.source,
            message: error instanceof Error ? error.message : String(error),
        });
    }
    if (!placementContact.phone) {
        logger_1.logger.info('Order confirmation sms skipped', {
            orderId: order.id,
            source: input.source,
            reason: 'missing_order_placement_phone',
        });
    }
    try {
        if (placementContact.phone) {
            smsSent = await withRetries('order-confirmation-sms-send', async () => (0, sms_1.sendOrderConfirmationSMS)(placementContact.phone, {
                customerName: placementContact.name || 'Guest',
                orderId: order.id.slice(0, 8).toUpperCase(),
                total: order.totalPaise / 100,
                tableNumber: order.table?.number || 0,
                restaurantName: order.restaurant?.name || 'Restaurant',
            }));
        }
    }
    catch (error) {
        logger_1.logger.error('Order confirmation sms failed', {
            orderId: order.id,
            source: input.source,
            message: error instanceof Error ? error.message : String(error),
        });
    }
    logger_1.logger.info('Order status notification processed', {
        orderId: order.id,
        source: input.source,
        previousStatus: input.previousStatus,
        nextStatus: input.nextStatus,
        emailSent,
        smsSent,
    });
    return { emailSent, smsSent };
};
exports.notifyOrderStatusChange = notifyOrderStatusChange;
//# sourceMappingURL=order-status-notification.service.js.map