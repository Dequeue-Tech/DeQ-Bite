import Razorpay from 'razorpay';
import crypto from 'crypto';
import { logger } from '@/utils/logger';

let razorpayInstance: Razorpay | null = null;

function getRazorpayInstance(): Razorpay {
  if (!razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials are not configured');
    }
    
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

export const razorpay = getRazorpayInstance;

export interface RazorpayOrderOptions {
  amount: number; // amount in INR
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

/**
 * Create a Razorpay order for payment processing
 */
export async function createRazorpayOrder(options: RazorpayOrderOptions) {
  try {
    const order = await getRazorpayInstance().orders.create({
      amount: Math.round(options.amount * 100), // Convert to paisa
      currency: options.currency || 'INR',
      receipt: options.receipt,
      notes: options.notes || {},
    });
    
    logger.info('Razorpay order created successfully', {
      orderId: order.id,
      amount: order.amount,
      receipt: options.receipt,
    });
    
    return order;
  } catch (error) {
    logger.error('Razorpay order creation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      receipt: options.receipt,
      amount: options.amount,
    });
    throw error;
  }
}

/**
 * Verify Razorpay payment signature for security
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  try {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest('hex');
    
    const isValid = expectedSignature === signature;
    
    logger.info('Payment signature verification', {
      orderId,
      paymentId,
      isValid,
      expectedSignature: expectedSignature.substring(0, 10) + '...', // Log only part of signature for security
      receivedSignature: signature.substring(0, 10) + '...', // Log only part of signature for security
    });
    
    if (!isValid) {
      logger.warn('Signature mismatch details', {
        orderId,
        paymentId,
        expectedLength: expectedSignature.length,
        receivedLength: signature.length,
      });
    }
    
    return isValid;
  } catch (error) {
    logger.error('Payment signature verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId,
      paymentId,
    });
    return false;
  }
}

/**
 * Capture a Razorpay payment (for payments that require manual capture)
 */
export async function captureRazorpayPayment(paymentId: string, amount: number) {
  try {
    const payment = await getRazorpayInstance().payments.capture(paymentId, Math.round(amount * 100), 'INR');
    
    logger.info('Payment captured successfully', {
      paymentId,
      amount: payment.amount,
      status: payment.status,
    });
    
    return payment;
  } catch (error) {
    logger.error('Payment capture failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      paymentId,
      amount,
    });
    throw error;
  }
}

/**
 * Refund a Razorpay payment
 */
export async function refundRazorpayPayment(
  paymentId: string, 
  amount?: number,
  reason?: string
) {
  try {
    const refundData: any = {};
    
    if (amount) {
      refundData.amount = Math.round(amount * 100);
    }
    
    if (reason) {
      refundData.notes = { reason };
    }
    
    const refund = await getRazorpayInstance().payments.refund(paymentId, refundData);
    
    logger.info('Payment refunded successfully', {
      paymentId,
      refundId: refund.id,
      amount: refund.amount,
      reason,
    });
    
    return refund;
  } catch (error) {
    logger.error('Payment refund failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      paymentId,
      amount,
      reason,
    });
    throw error;
  }
}

/**
 * Fetch payment details from Razorpay
 */
export async function fetchPaymentDetails(paymentId: string) {
  try {
    const payment = await getRazorpayInstance().payments.fetch(paymentId);
    
    logger.info('Payment details fetched', {
      paymentId,
      status: payment.status,
      amount: payment.amount,
    });
    
    return payment;
  } catch (error) {
    logger.error('Failed to fetch payment details', {
      error: error instanceof Error ? error.message : 'Unknown error',
      paymentId,
    });
    throw error;
  }
}

/**
 * Validate webhook signature from Razorpay
 */
export function validateWebhookSignature(
  body: string,
  signature: string,
  secret: string = process.env['RAZORPAY_WEBHOOK_SECRET']!
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    return expectedSignature === signature;
  } catch (error) {
    logger.error('Webhook signature validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}