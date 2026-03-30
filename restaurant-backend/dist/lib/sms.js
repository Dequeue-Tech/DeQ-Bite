"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = sendSMS;
exports.generateInvoiceSMSMessage = generateInvoiceSMSMessage;
exports.sendInvoiceSMS = sendInvoiceSMS;
exports.sendOrderConfirmationSMS = sendOrderConfirmationSMS;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const isValidE164 = (value) => /^\+\d{10,15}$/.test(value);
const normalizePhone = (value) => value.replace(/[\s()-]/g, '');
const getConfiguredSMSProvider = () => (process.env['SMS_PROVIDER'] || 'textbelt').trim().toLowerCase();
const sendViaTextbelt = async (options) => {
    const endpoint = process.env['TEXTBELT_API_URL'] || 'https://textbelt.com/text';
    const key = process.env['TEXTBELT_KEY'];
    const response = await axios_1.default.post(endpoint, {
        phone: options.to,
        message: options.message,
        key,
    }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
    });
    const payload = response.data;
    if (!payload?.success) {
        logger_1.logger.error('Textbelt SMS send failed', {
            to: options.to,
            error: payload?.error || 'Unknown Textbelt error',
            quotaRemaining: payload?.quotaRemaining,
        });
        return false;
    }
    logger_1.logger.info('SMS sent successfully', {
        provider: 'textbelt',
        to: options.to,
        textId: payload.textId,
        quotaRemaining: payload.quotaRemaining,
    });
    return true;
};
const smsProviders = {
    textbelt: {
        name: 'textbelt',
        getMissingConfig: () => {
            const missing = [];
            if (!process.env['TEXTBELT_KEY'])
                missing.push('TEXTBELT_KEY');
            return missing;
        },
        send: sendViaTextbelt,
    },
    disabled: {
        name: 'disabled',
        getMissingConfig: () => [],
        send: async () => {
            logger_1.logger.warn('SMS service disabled by configuration');
            return false;
        },
    },
};
const resolveSMSProvider = () => {
    const providerName = getConfiguredSMSProvider();
    if (providerName === 'textbelt' || providerName === 'disabled') {
        return smsProviders[providerName];
    }
    logger_1.logger.error('Unsupported SMS provider configured', {
        provider: providerName,
        supportedProviders: Object.keys(smsProviders),
    });
    return null;
};
async function sendSMS(options) {
    const normalizedTo = normalizePhone(options.to);
    if (!isValidE164(normalizedTo)) {
        logger_1.logger.error('Invalid destination phone number', { to: options.to, normalizedTo });
        return false;
    }
    const provider = resolveSMSProvider();
    if (!provider)
        return false;
    const missingConfig = provider.getMissingConfig();
    if (missingConfig.length > 0) {
        logger_1.logger.error('SMS configuration incomplete', { provider: provider.name, missingConfig });
        return false;
    }
    try {
        const smsPayload = {
            to: normalizedTo,
            message: options.message,
        };
        return await provider.send(smsPayload);
    }
    catch (error) {
        logger_1.logger.error('Failed to send SMS', {
            provider: provider.name,
            error: error instanceof Error ? error.message : 'Unknown error',
            to: normalizedTo,
        });
        return false;
    }
}
function generateInvoiceSMSMessage(invoiceData) {
    return `Dear ${invoiceData.customerName},

Your invoice #${invoiceData.invoiceNumber} for ₹${invoiceData.total.toFixed(2)} has been generated.

Thank you for dining with ${invoiceData.restaurantName}!

This is an automated message.`;
}
async function sendInvoiceSMS(phone, invoiceData) {
    const message = generateInvoiceSMSMessage(invoiceData);
    return await sendSMS({
        to: phone,
        message,
    });
}
async function sendOrderConfirmationSMS(phone, orderData) {
    const message = `Dear ${orderData.customerName},

Your order #${orderData.orderId} for ₹${orderData.total.toFixed(2)} has been confirmed for Table ${orderData.tableNumber}.

Thank you for choosing ${orderData.restaurantName}!

This is an automated message.`;
    return await sendSMS({
        to: phone,
        message,
    });
}
//# sourceMappingURL=sms.js.map