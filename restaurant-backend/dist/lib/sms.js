"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = sendSMS;
exports.sendOrderConfirmationSMS = sendOrderConfirmationSMS;
exports.sendOrderCompletionSMS = sendOrderCompletionSMS;
const axios_1 = __importDefault(require("axios"));
const twilio_1 = __importDefault(require("twilio"));
const logger_1 = require("../utils/logger");
const shortenUrl = async (longUrl) => {
    try {
        const response = await axios_1.default.get("https://tinyurl.com/api/create.php", {
            params: { url: longUrl },
            timeout: 5000,
        });
        return typeof response.data === "string" && response.data.trim()
            ? response.data
            : longUrl;
    }
    catch (error) {
        logger_1.logger.warn("Failed to shorten URL, using original", {
            url: longUrl,
            error: error instanceof Error ? error.message : "Unknown error",
        });
        return longUrl;
    }
};
const isValidE164 = (value) => /^\+\d{10,15}$/.test(value);
const normalizePhone = (value) => {
    let cleaned = value.replace(/[^\d+]/g, "");
    if (cleaned.length === 10 && !cleaned.startsWith("+")) {
        cleaned = "+91" + cleaned;
    }
    else if (cleaned.length > 10 && !cleaned.startsWith("+")) {
        cleaned = "+" + cleaned;
    }
    return cleaned;
};
const getConfiguredSMSProvider = () => {
    const configured = (process.env["SMS_PROVIDER"] || "fast2sms")
        .trim()
        .toLowerCase();
    if (configured === "fast2sms" ||
        configured === "twilio" ||
        configured === "disabled") {
        return configured;
    }
    logger_1.logger.warn("Unsupported SMS_PROVIDER, defaulting to fast2sms", {
        configured,
    });
    return "fast2sms";
};
const toFast2SMSNumber = (value) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 10)
        return digits;
    if (digits.length === 12 && digits.startsWith("91"))
        return digits.slice(2);
    return null;
};
const sendViaFast2SMS = async (options) => {
    const endpoint = process.env["FAST2SMS_API_URL"] || "https://www.fast2sms.com/dev/bulkV2";
    const apiKey = process.env["FAST2SMS_API_KEY"];
    const route = process.env["FAST2SMS_ROUTE"] || "q";
    const language = process.env["FAST2SMS_LANGUAGE"] || "english";
    const number = toFast2SMSNumber(options.to);
    if (!number) {
        logger_1.logger.error("Fast2SMS requires a valid 10-digit Indian mobile number", {
            to: options.to,
        });
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
                "Content-Type": "application/x-www-form-urlencoded",
                "Cache-Control": "no-cache",
            },
            timeout: 10000,
        });
        const data = response.data;
        if (data.return === false) {
            logger_1.logger.error("Fast2SMS rejected the message", {
                to: options.to,
                raw_response: data,
            });
            return false;
        }
        logger_1.logger.info("SMS sent successfully", {
            provider: "fast2sms",
            to: options.to,
            requestId: data.request_id,
        });
        return true;
    }
    catch (error) {
        logger_1.logger.error("Fast2SMS API Request Failed", {
            to: options.to,
            status: error.response?.status,
            fast2sms_error: error.response?.data || error.message,
        });
        return false;
    }
};
const sendViaTwilio = async (options) => {
    const accountSid = process.env["TWILIO_ACCOUNT_SID"];
    const authToken = process.env["TWILIO_AUTH_TOKEN"];
    const from = process.env["TWILIO_PHONE_NUMBER"];
    const messagingServiceSid = process.env["TWILIO_MESSAGING_SERVICE_SID"];
    const client = (0, twilio_1.default)(accountSid, authToken);
    try {
        const payload = {
            body: options.message,
            to: options.to,
        };
        if (messagingServiceSid) {
            payload.messagingServiceSid = messagingServiceSid;
        }
        else if (from) {
            payload.from = from;
        }
        else {
            logger_1.logger.error("Twilio sender configuration missing", {
                required: ["TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID"],
            });
            return false;
        }
        const result = await client.messages.create(payload);
        logger_1.logger.info("SMS sent successfully", {
            provider: "twilio",
            to: options.to,
            sid: result.sid,
            status: result.status,
        });
        return true;
    }
    catch (error) {
        logger_1.logger.error("Twilio API Request Failed", {
            to: options.to,
            code: error?.code,
            status: error?.status,
            twilio_error: error?.message || "Unknown error",
            moreInfo: error?.moreInfo,
        });
        return false;
    }
};
const smsProviders = {
    fast2sms: {
        name: "fast2sms",
        getMissingConfig: () => {
            const missing = [];
            if (!process.env["FAST2SMS_API_KEY"])
                missing.push("FAST2SMS_API_KEY");
            return missing;
        },
        send: sendViaFast2SMS,
    },
    twilio: {
        name: "twilio",
        getMissingConfig: () => {
            const missing = [];
            if (!process.env["TWILIO_ACCOUNT_SID"])
                missing.push("TWILIO_ACCOUNT_SID");
            if (!process.env["TWILIO_AUTH_TOKEN"])
                missing.push("TWILIO_AUTH_TOKEN");
            if (!process.env["TWILIO_PHONE_NUMBER"] &&
                !process.env["TWILIO_MESSAGING_SERVICE_SID"]) {
                missing.push("TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID");
            }
            return missing;
        },
        send: sendViaTwilio,
    },
    disabled: {
        name: "disabled",
        getMissingConfig: () => [],
        send: async () => {
            logger_1.logger.warn("SMS service disabled by configuration");
            return false;
        },
    },
};
const resolveSMSProvider = () => {
    const providerName = getConfiguredSMSProvider();
    if (providerName === "fast2sms" ||
        providerName === "twilio" ||
        providerName === "disabled") {
        return smsProviders[providerName];
    }
    logger_1.logger.error("Unsupported SMS provider configured", {
        provider: providerName,
        supportedProviders: Object.keys(smsProviders),
    });
    return null;
};
async function sendSMS(options) {
    const normalizedTo = normalizePhone(options.to);
    if (!isValidE164(normalizedTo)) {
        logger_1.logger.error("Invalid destination phone number", {
            to: options.to,
            normalizedTo,
        });
        return false;
    }
    const provider = resolveSMSProvider();
    if (!provider)
        return false;
    const missingConfig = provider.getMissingConfig();
    if (missingConfig.length > 0) {
        logger_1.logger.error("SMS configuration incomplete", {
            provider: provider.name,
            missingConfig,
        });
        return false;
    }
    try {
        const smsPayload = {
            to: normalizedTo,
            message: options.message,
        };
        const retriesRaw = Number(process.env["SMS_RETRY_ATTEMPTS"] || 2);
        const maxRetries = Number.isFinite(retriesRaw) && retriesRaw >= 0
            ? Math.min(Math.floor(retriesRaw), 5)
            : 2;
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
            const delivered = await provider.send(smsPayload);
            if (delivered) {
                if (attempt > 0) {
                    logger_1.logger.info("SMS delivered after retry", {
                        provider: provider.name,
                        to: normalizedTo,
                        attempt: attempt + 1,
                    });
                }
                return true;
            }
            if (attempt < maxRetries) {
                logger_1.logger.warn("SMS send attempt failed, retrying", {
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
        logger_1.logger.error("Failed to send SMS", {
            provider: provider.name,
            error: error instanceof Error ? error.message : "Unknown error",
            to: normalizedTo,
        });
        return false;
    }
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
    const shortUrl = await shortenUrl(data.invoiceUrl);
    const message = `Hi ${data.customerName},
Thanks for dining at ${data.restaurantName}.
View your invoice: ${shortUrl} - ${data.restaurantName}`;
    return sendSMS({ to: phone, message });
}
//# sourceMappingURL=sms.js.map