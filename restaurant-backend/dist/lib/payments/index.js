"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnabledProviders = exports.getPaymentProvider = void 0;
const errorHandler_1 = require("@/middleware/errorHandler");
const razorpay_1 = require("@/lib/razorpay");
const razorpayProvider = {
    provider: 'RAZORPAY',
    isEnabled: () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    createOrder: async (input) => {
        if (!razorpayProvider.isEnabled()) {
            throw new errorHandler_1.AppError('Razorpay is not configured', 400);
        }
        const order = await (0, razorpay_1.createRazorpayOrder)({
            amountPaise: input.amountPaise,
            receipt: input.receipt,
            notes: input.notes,
        });
        return {
            provider: 'RAZORPAY',
            paymentOrderId: order.id,
            amountPaise: order.amount,
            currency: 'INR',
            publicKey: process.env.RAZORPAY_KEY_ID,
        };
    },
    verifyPayment: async (input) => {
        if (!input.razorpay_order_id || !input.razorpay_payment_id || !input.razorpay_signature) {
            throw new errorHandler_1.AppError('Missing Razorpay verification fields', 400);
        }
        const isValid = (0, razorpay_1.verifyRazorpaySignature)(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature);
        if (!isValid) {
            throw new errorHandler_1.AppError('Invalid payment signature', 400);
        }
        const paymentDetails = await (0, razorpay_1.fetchPaymentDetails)(input.razorpay_payment_id);
        if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
            throw new errorHandler_1.AppError(`Payment not successful. Status: ${paymentDetails.status}`, 400);
        }
        return { status: paymentDetails.status };
    },
    refund: async (paymentId, amountPaise, reason) => {
        return (0, razorpay_1.refundRazorpayPayment)(paymentId, amountPaise, reason);
    },
};
const paytmProvider = {
    provider: 'PAYTM',
    isEnabled: () => Boolean(process.env.PAYTM_MERCHANT_ID && process.env.PAYTM_MERCHANT_KEY),
    createOrder: async () => {
        throw new errorHandler_1.AppError('Paytm integration is not configured in this build', 501);
    },
    verifyPayment: async () => {
        throw new errorHandler_1.AppError('Paytm integration is not configured in this build', 501);
    },
    refund: async () => {
        throw new errorHandler_1.AppError('Paytm integration is not configured in this build', 501);
    },
};
const phonepeProvider = {
    provider: 'PHONEPE',
    isEnabled: () => Boolean(process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY),
    createOrder: async () => {
        throw new errorHandler_1.AppError('PhonePe integration is not configured in this build', 501);
    },
    verifyPayment: async () => {
        throw new errorHandler_1.AppError('PhonePe integration is not configured in this build', 501);
    },
    refund: async () => {
        throw new errorHandler_1.AppError('PhonePe integration is not configured in this build', 501);
    },
};
const providers = {
    RAZORPAY: razorpayProvider,
    PAYTM: paytmProvider,
    PHONEPE: phonepeProvider,
};
const getPaymentProvider = (provider) => providers[provider];
exports.getPaymentProvider = getPaymentProvider;
const getEnabledProviders = () => {
    return Object.values(providers)
        .filter((provider) => provider.isEnabled())
        .map((provider) => provider.provider);
};
exports.getEnabledProviders = getEnabledProviders;
//# sourceMappingURL=index.js.map