import axios from 'axios';
import { logger } from '@/utils/logger';

// Fast2SMS API configuration
const FAST2SMS_BASE_URL = 'https://www.fast2sms.com/dev/bulkV2';

export interface Fast2SMSOptions {
  to: string;
  message: string;
}

/**
 * Send SMS using Fast2SMS API
 */
export async function sendFast2SMS(options: Fast2SMSOptions): Promise<boolean> {
  try {
    const apiKey = process.env['FAST2SMS_API_KEY'];
    const senderId = process.env['FAST2SMS_SENDER_ID'] || 'FASTSM';

    if (!apiKey) {
      logger.error('Fast2SMS API key not configured');
      return false;
    }

    if (!options.to || !options.message) {
      logger.error('Invalid SMS options - missing phone or message');
      return false;
    }

    // Clean phone number (remove +, spaces, dashes)
    const cleanPhone = options.to.replace(/[\+\-\s]/g, '');

    const response = await axios.post(
      FAST2SMS_BASE_URL,
      {
        routing: 'promotional', // Use 'transactional' for transactional messages
        sender_id: senderId,
        flash: 0,
        text: options.message,
        numbers: [cleanPhone],
      },
      {
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = response.data;

    if (result.return && result.return_code === 'SUCCESS') {
      logger.info('Fast2SMS sent successfully', {
        to: options.to,
        messageId: result.message_id,
        status: result.status,
      });
      return true;
    } else {
      logger.error('Fast2SMS API returned error', {
        to: options.to,
        error: result.return_message || 'Unknown error',
        returnCode: result.return_code,
      });
      return false;
    }
  } catch (error) {
    logger.error('Failed to send Fast2SMS', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: options.to,
    });
    return false;
  }
}

/**
 * Generate order confirmation SMS message
 */
export function generateOrderConfirmationSMS(orderData: {
  customerName: string;
  orderId: string;
  total: number;
  tableNumber: number;
  restaurantName: string;
  estimatedTime?: string;
}): string {
  const timeInfo = orderData.estimatedTime 
    ? ` Estimated time: ${orderData.estimatedTime}.` 
    : '';

  return `Dear ${orderData.customerName},

Your order #${orderData.orderId} for ₹${orderData.total.toFixed(2)} has been CONFIRMED for Table ${orderData.tableNumber} at ${orderData.restaurantName}.${timeInfo}

Thank you for choosing us!

This is an automated message.`;
}

/**
 * Generate order completion SMS message
 */
export function generateOrderCompletionSMS(orderData: {
  customerName: string;
  orderId: string;
  total: number;
  paymentMethod: string;
  restaurantName: string;
}): string {
  return `Dear ${orderData.customerName},

Your order #${orderData.orderId} has been COMPLETED successfully.

Amount Paid: ₹${orderData.total.toFixed(2)}
Payment Method: ${orderData.paymentMethod}

Thank you for dining with ${orderData.restaurantName}! We hope to see you again.

This is an automated message.`;
}

/**
 * Send order confirmation SMS notification
 */
export async function sendOrderConfirmationSMS(
  phone: string,
  orderData: {
    customerName: string;
    orderId: string;
    total: number;
    tableNumber: number;
    restaurantName: string;
    estimatedTime?: string;
  }
): Promise<boolean> {
  const message = generateOrderConfirmationSMS(orderData);
  
  return await sendFast2SMS({
    to: phone,
    message,
  });
}

/**
 * Send order completion SMS notification
 */
export async function sendOrderCompletionSMS(
  phone: string,
  orderData: {
    customerName: string;
    orderId: string;
    total: number;
    paymentMethod: string;
    restaurantName: string;
  }
): Promise<boolean> {
  const message = generateOrderCompletionSMS(orderData);
  
  return await sendFast2SMS({
    to: phone,
    message,
  });
}
