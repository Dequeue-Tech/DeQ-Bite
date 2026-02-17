"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = sendSMS;
exports.generateInvoiceSMSMessage = generateInvoiceSMSMessage;
exports.sendInvoiceSMS = sendInvoiceSMS;
exports.sendOrderConfirmationSMS = sendOrderConfirmationSMS;
const twilio_1 = require("twilio");
const logger_1 = require("../utils/logger");
let twilioClient = null;
const initializeTwilio = () => {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        logger_1.logger.warn('Twilio credentials not configured, SMS service disabled');
        return null;
    }
    if (!twilioClient) {
        twilioClient = new twilio_1.Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    return twilioClient;
};
async function sendSMS(options) {
    try {
        const client = initializeTwilio();
        if (!client) {
            logger_1.logger.error('SMS service not available - Twilio not configured');
            return false;
        }
        if (!process.env.TWILIO_PHONE_NUMBER) {
            logger_1.logger.error('Twilio phone number not configured');
            return false;
        }
        const result = await client.messages.create({
            body: options.message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: options.to,
        });
        logger_1.logger.info('SMS sent successfully', {
            to: options.to,
            sid: result.sid,
            status: result.status,
        });
        return true;
    }
    catch (error) {
        logger_1.logger.error('Failed to send SMS', {
            error: error instanceof Error ? error.message : 'Unknown error',
            to: options.to,
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