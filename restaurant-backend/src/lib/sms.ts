import { Twilio } from 'twilio';
import { logger } from '@/utils/logger';

// Initialize Twilio client
let twilioClient: Twilio | null = null;

const initializeTwilio = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    logger.warn('Twilio credentials not configured, SMS service disabled');
    return null;
  }
  
  if (!twilioClient) {
    twilioClient = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  
  return twilioClient;
};

export interface SMSOptions {
  to: string;
  message: string;
}

/**
 * Send SMS message
 */
export async function sendSMS(options: SMSOptions): Promise<boolean> {
  try {
    const client = initializeTwilio();
    
    if (!client) {
      logger.error('SMS service not available - Twilio not configured');
      return false;
    }
    
    if (!process.env.TWILIO_PHONE_NUMBER) {
      logger.error('Twilio phone number not configured');
      return false;
    }
    
    const result = await client.messages.create({
      body: options.message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: options.to,
    });
    
    logger.info('SMS sent successfully', {
      to: options.to,
      sid: result.sid,
      status: result.status,
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to send SMS', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: options.to,
    });
    
    return false;
  }
}

/**
 * Generate invoice SMS message
 */
export function generateInvoiceSMSMessage(invoiceData: {
  customerName: string;
  invoiceNumber: string;
  total: number;
  restaurantName: string;
}): string {
  return `Dear ${invoiceData.customerName},

Your invoice #${invoiceData.invoiceNumber} for ₹${invoiceData.total.toFixed(2)} has been generated.

Thank you for dining with ${invoiceData.restaurantName}!

This is an automated message.`;
}

/**
 * Send invoice SMS notification
 */
export async function sendInvoiceSMS(
  phone: string,
  invoiceData: {
    customerName: string;
    invoiceNumber: string;
    total: number;
    restaurantName: string;
  }
): Promise<boolean> {
  const message = generateInvoiceSMSMessage(invoiceData);
  
  return await sendSMS({
    to: phone,
    message,
  });
}

/**
 * Send order confirmation SMS
 */
export async function sendOrderConfirmationSMS(
  phone: string,
  orderData: {
    customerName: string;
    orderId: string;
    total: number;
    tableNumber: number;
    restaurantName: string;
  }
): Promise<boolean> {
  const message = `Dear ${orderData.customerName},

Your order #${orderData.orderId} for ₹${orderData.total.toFixed(2)} has been confirmed for Table ${orderData.tableNumber}.

Thank you for choosing ${orderData.restaurantName}!

This is an automated message.`;
  
  return await sendSMS({
    to: phone,
    message,
  });
}