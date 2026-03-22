import { prisma } from '@/config/database';
import { 
  sendOrderConfirmationEmail, 
  sendOrderCompletionEmail,
} from './email';
import { 
  sendOrderConfirmationSMS, 
  sendOrderCompletionSMS 
} from './fast2sms';
import { downloadPDFFromStorage } from './pdf';
import { logger } from '@/utils/logger';

export interface NotificationResult {
  emailSent: boolean;
  smsSent: boolean;
  errors?: {
    email?: string;
    sms?: string;
  };
}

/**
 * Send order confirmation notification via SMS and Email
 */
export async function sendOrderConfirmationNotification(
  order: any,
  invoicePdfPath?: string
): Promise<NotificationResult> {
  const result: NotificationResult = {
    emailSent: false,
    smsSent: false,
    errors: {},
  };

  try {
    // Prepare order data for notifications
    const orderData: any = {
      customerName: order.user?.name || 'Customer',
      orderId: order.id,
      orderDate: order.createdAt.toLocaleDateString('en-IN'),
      items: (order.items || []).map((item: any) => ({
        name: item.menuItem?.name || 'Item',
        quantity: item.quantity,
      })),
      total: order.totalPaise / 100,
      tableNumber: order.table?.number || 0,
      restaurantName: order.restaurant?.name || 'Restaurant',
    };

    // Add estimatedTime only if available
    if (order.estimatedDeliveryTime) {
      orderData.estimatedTime = order.estimatedDeliveryTime;
    }

    // Send email notification if user has email
    if (order.user?.email) {
      try {
        result.emailSent = await sendOrderConfirmationEmail(
          order.user.email,
          orderData
        );
        
        logger.info('Order confirmation email sent', {
          orderId: order.id,
          email: order.user.email,
        });
      } catch (emailError) {
        logger.error('Failed to send order confirmation email', {
          orderId: order.id,
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
        });
        result.errors!.email = emailError instanceof Error ? emailError.message : 'Email sending failed';
      }
    } else {
      logger.warn('No email address available for order confirmation', {
        orderId: order.id,
      });
    }

    // Send SMS notification if user has phone
    if (order.user?.phone) {
      try {
        result.smsSent = await sendOrderConfirmationSMS(
          order.user.phone,
          orderData
        );
        
        logger.info('Order confirmation SMS sent', {
          orderId: order.id,
          phone: order.user.phone,
        });
      } catch (smsError) {
        logger.error('Failed to send order confirmation SMS', {
          orderId: order.id,
          error: smsError instanceof Error ? smsError.message : 'Unknown error',
        });
        result.errors!.sms = smsError instanceof Error ? smsError.message : 'SMS sending failed';
      }
    } else {
      logger.warn('No phone number available for order confirmation', {
        orderId: order.id,
      });
    }

    return result;
  } catch (error) {
    logger.error('Order confirmation notification failed', {
      orderId: order.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return result;
  }
}

/**
 * Send order completion notification via SMS and Email with invoice
 */
export async function sendOrderCompletionNotification(
  order: any,
  invoicePdfPath: string
): Promise<NotificationResult> {
  const result: NotificationResult = {
    emailSent: false,
    smsSent: false,
    errors: {},
  };

  try {
    // Download invoice PDF from storage
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await downloadPDFFromStorage(invoicePdfPath);
    } catch (pdfError) {
      logger.error('Failed to download invoice PDF for completion notification', {
        orderId: order.id,
        invoicePdfPath,
        error: pdfError instanceof Error ? pdfError.message : 'Unknown error',
      });
      // Continue with notification even without PDF
    }

    // Prepare order data for notifications
    const orderData = {
      customerName: order.user?.name || 'Customer',
      orderId: order.id,
      orderDate: order.createdAt.toLocaleDateString('en-IN'),
      total: order.totalPaise / 100,
      paymentMethod: order.paymentProvider || 'Online',
      restaurantName: order.restaurant?.name || 'Restaurant',
    };

    // Send email notification if user has email
    if (order.user?.email) {
      try {
        if (pdfBuffer) {
          result.emailSent = await sendOrderCompletionEmail(
            order.user.email,
            orderData,
            pdfBuffer
          );
          
          logger.info('Order completion email sent with invoice', {
            orderId: order.id,
            email: order.user.email,
          });
        } else {
          // Send email without attachment if PDF download failed
          result.emailSent = await sendOrderCompletionEmail(
            order.user.email,
            orderData,
            Buffer.from('') // Empty buffer - will skip attachment
          );
          
          logger.warn('Order completion email sent without invoice (PDF download failed)', {
            orderId: order.id,
            email: order.user.email,
          });
        }
      } catch (emailError) {
        logger.error('Failed to send order completion email', {
          orderId: order.id,
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
        });
        result.errors!.email = emailError instanceof Error ? emailError.message : 'Email sending failed';
      }
    } else {
      logger.warn('No email address available for order completion', {
        orderId: order.id,
      });
    }

    // Send SMS notification if user has phone
    if (order.user?.phone) {
      try {
        result.smsSent = await sendOrderCompletionSMS(
          order.user.phone,
          orderData
        );
        
        logger.info('Order completion SMS sent', {
          orderId: order.id,
          phone: order.user.phone,
        });
      } catch (smsError) {
        logger.error('Failed to send order completion SMS', {
          orderId: order.id,
          error: smsError instanceof Error ? smsError.message : 'Unknown error',
        });
        result.errors!.sms = smsError instanceof Error ? smsError.message : 'SMS sending failed';
      }
    } else {
      logger.warn('No phone number available for order completion', {
        orderId: order.id,
      });
    }

    return result;
  } catch (error) {
    logger.error('Order completion notification failed', {
      orderId: order.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return result;
  }
}
