"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = sendSMS;
exports.generateInvoiceSMSMessage = generateInvoiceSMSMessage;
exports.sendInvoiceSMS = sendInvoiceSMS;
exports.sendOrderConfirmationSMS = sendOrderConfirmationSMS;
exports.sendOrderCompletionSMS = sendOrderCompletionSMS;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const isValidE164 = (value) => /^\+\d{10,15}$/.test(value);
const normalizePhone = (value) => {
    let cleaned = value.replace(/[^\d+]/g, '');
    if (cleaned.length === 10 && !cleaned.startsWith('+')) {
        cleaned = '+91' + cleaned;
    }
    else if (cleaned.length > 10 && !cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }
    return cleaned;
};
const getConfiguredSMSProvider = () => (process.env['SMS_PROVIDER'] || 'textbelt').trim().toLowerCase();
const toFast2SMSNumber = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10)
        return digits;
    if (digits.length === 12 && digits.startsWith('91'))
        return digits.slice(2);
    return null;
};
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
const sendViaFast2SMS = async (options) => {
    const endpoint = process.env['FAST2SMS_API_URL'] || 'https://www.fast2sms.com/dev/bulkV2';
    const apiKey = process.env['FAST2SMS_API_KEY'];
    const route = process.env['FAST2SMS_ROUTE'] || 'q';
    const language = process.env['FAST2SMS_LANGUAGE'] || 'english';
    const number = toFast2SMSNumber(options.to);
    if (!number) {
        logger_1.logger.error('Fast2SMS requires a valid 10-digit Indian mobile number', { to: options.to });
        return false;
    }
    const payload = new URLSearchParams({
        message: options.message,
        language,
        route,
        numbers: number,
    });
    try {
        const response = await axios_1.default.post(endpoint, payload.toString(), {
            headers: {
                authorization: apiKey,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cache-Control': 'no-cache',
            },
            timeout: 10000,
        });
        const data = response.data;
        if (data.return === false) {
            logger_1.logger.error('Fast2SMS rejected the message', {
                to: options.to,
                raw_response: data
            });
            return false;
        }
        logger_1.logger.info('SMS sent successfully', {
            provider: 'fast2sms',
            to: options.to,
            requestId: data.request_id,
        });
        return true;
    }
    catch (error) {
        logger_1.logger.error('Fast2SMS API Request Failed', {
            to: options.to,
            status: error.response?.status,
            fast2sms_error: error.response?.data || error.message,
        });
        return false;
    }
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
    fast2sms: {
        name: 'fast2sms',
        getMissingConfig: () => {
            const missing = [];
            if (!process.env['FAST2SMS_API_KEY'])
                missing.push('FAST2SMS_API_KEY');
            return missing;
        },
        send: sendViaFast2SMS,
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
    if (providerName === 'textbelt' || providerName === 'fast2sms' || providerName === 'disabled') {
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
        const retriesRaw = Number(process.env['SMS_RETRY_ATTEMPTS'] || 2);
        const maxRetries = Number.isFinite(retriesRaw) && retriesRaw >= 0 ? Math.min(Math.floor(retriesRaw), 5) : 2;
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
            const delivered = await provider.send(smsPayload);
            if (delivered) {
                if (attempt > 0) {
                    logger_1.logger.info('SMS delivered after retry', {
                        provider: provider.name,
                        to: normalizedTo,
                        attempt: attempt + 1,
                    });
                }
                return true;
            }
            if (attempt < maxRetries) {
                logger_1.logger.warn('SMS send attempt failed, retrying', {
                    provider: provider.name,
                    to: normalizedTo,
                    nextAttempt: attempt + 2,
                });
                await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
            }
        }
        return false;
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
async function sendOrderCompletionSMS(phone, data) {
    const message = `Hi ${data.customerName}, your order is completed at ${data.restaurantName}. Invoice ${data.invoiceNumber} (Rs.${data.total.toFixed(2)}): ${data.invoiceUrl}`;
    return sendSMS({ to: phone, message });
}
//# sourceMappingURL=sms.js.map