"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpay = void 0;
exports.createRazorpayOrder = createRazorpayOrder;
exports.verifyRazorpaySignature = verifyRazorpaySignature;
exports.captureRazorpayPayment = captureRazorpayPayment;
exports.refundRazorpayPayment = refundRazorpayPayment;
exports.fetchPaymentDetails = fetchPaymentDetails;
exports.validateWebhookSignature = validateWebhookSignature;
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
let razorpayInstance = null;
function getRazorpayInstance() {
    if (!razorpayInstance) {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay credentials are not configured');
        }
        razorpayInstance = new razorpay_1.default({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpayInstance;
}
exports.razorpay = getRazorpayInstance;
async function createRazorpayOrder(options) {
    try {
        const createStartTime = Date.now();
        const order = await getRazorpayInstance().orders.create({
            amount: Math.round(options.amountPaise),
            currency: options.currency || 'INR',
            receipt: options.receipt,
            notes: options.notes || {},
        });
        const createDuration = Date.now() - createStartTime;
        logger_1.logger.info('Razorpay order created successfully', {
            orderId: order.id,
            amount: order.amount,
            receipt: options.receipt,
            duration: `${createDuration}ms`,
        });
        return order;
    }
    catch (error) {
        logger_1.logger.error('Razorpay order creation failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            receipt: options.receipt,
            amount: options.amountPaise,
        });
        throw error;
    }
}
function verifyRazorpaySignature(orderId, paymentId, signature) {
    try {
        const body = orderId + '|' + paymentId;
        const expectedSignature = crypto_1.default
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');
        const isValid = expectedSignature === signature;
        logger_1.logger.info('Payment signature verification', {
            orderId,
            paymentId,
            isValid,
            expectedSignature: expectedSignature.substring(0, 10) + '...',
            receivedSignature: signature.substring(0, 10) + '...',
        });
        if (!isValid) {
            logger_1.logger.warn('Signature mismatch details', {
                orderId,
                paymentId,
                expectedLength: expectedSignature.length,
                receivedLength: signature.length,
            });
        }
        return isValid;
    }
    catch (error) {
        logger_1.logger.error('Payment signature verification failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            orderId,
            paymentId,
        });
        return false;
    }
}
async function captureRazorpayPayment(paymentId, amount) {
    try {
        const payment = await getRazorpayInstance().payments.capture(paymentId, Math.round(amount), 'INR');
        logger_1.logger.info('Payment captured successfully', {
            paymentId,
            amount: payment.amount,
            status: payment.status,
        });
        return payment;
    }
    catch (error) {
        logger_1.logger.error('Payment capture failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            paymentId,
            amount,
        });
        throw error;
    }
}
async function refundRazorpayPayment(paymentId, amountPaise, reason) {
    try {
        const refundData = {};
        if (amountPaise) {
            refundData.amount = Math.round(amountPaise);
        }
        if (reason) {
            refundData.notes = { reason };
        }
        const refund = await getRazorpayInstance().payments.refund(paymentId, refundData);
        logger_1.logger.info('Payment refunded successfully', {
            paymentId,
            refundId: refund.id,
            amount: refund.amount,
            reason,
        });
        return refund;
    }
    catch (error) {
        logger_1.logger.error('Payment refund failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            paymentId,
            amount: amountPaise,
            reason,
        });
        throw error;
    }
}
async function fetchPaymentDetails(paymentId) {
    try {
        const fetchStartTime = Date.now();
        const payment = await getRazorpayInstance().payments.fetch(paymentId);
        const fetchDuration = Date.now() - fetchStartTime;
        logger_1.logger.info('Payment details fetched', {
            paymentId,
            status: payment.status,
            amount: payment.amount,
            duration: `${fetchDuration}ms`,
        });
        return payment;
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch payment details', {
            error: error instanceof Error ? error.message : 'Unknown error',
            paymentId,
        });
        throw error;
    }
}
function validateWebhookSignature(body, signature, secret = process.env['RAZORPAY_WEBHOOK_SECRET']) {
    try {
        const expectedSignature = crypto_1.default
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');
        return expectedSignature === signature;
    }
    catch (error) {
        logger_1.logger.error('Webhook signature validation failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
    }
}
//# sourceMappingURL=razorpay.js.map