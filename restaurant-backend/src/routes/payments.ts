import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { AppError, asyncHandler } from '@/middleware/errorHandler';
import { 
  createRazorpayOrder, 
  verifyRazorpaySignature,
  fetchPaymentDetails,
  refundRazorpayPayment 
} from '@/lib/razorpay';
import { AuthenticatedRequest, ApiResponse } from '@/types/api';
import { logger } from '@/utils/logger';
import { generateInvoicePDF, savePDFToStorage } from '@/lib/pdf';
import { sendInvoiceEmail } from '@/lib/email';
// Removed unused import
// import { sendInvoiceSMS } from '@/lib/sms';

const router = Router();

// Validation schemas
const createPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Razorpay order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Razorpay payment ID is required'),
  razorpay_signature: z.string().min(1, 'Razorpay signature is required'),
});

const refundPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
});

// POST /api/payments/create - Create a new payment order
router.post('/create', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { orderId } = createPaymentSchema.parse(req.body);

  // Get the order and verify it belongs to the user
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: req.user!.id,
      paymentStatus: 'PENDING',
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
      table: {
        select: {
          number: true,
          location: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError('Order not found or already processed', 404);
  }

  try {
    // Create Razorpay order
    const razorpayOrder = await createRazorpayOrder({
      amount: order.total,
      receipt: `order_${order.id}`,
      notes: {
        orderId: order.id,
        userId: req.user!.id,
        tableId: order.tableId,
        customerName: order.user.name,
        tableNumber: String(order.table.number),
      },
    });

    // Update order with payment details
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentId: razorpayOrder.id,
        paymentStatus: 'PROCESSING',
      },
    });

    logger.info('Payment order created', {
      orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: order.total,
      userId: req.user!.id,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Payment order created successfully',
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        customerDetails: {
          name: order.user.name,
          email: order.user.email,
          phone: order.user.phone,
        },
      },
    };

    return res.status(201).json(response);
  } catch (error) {
    logger.error('Payment order creation failed', {
      orderId,
      userId: req.user!.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new AppError('Failed to create payment order', 500);
  }
}));

// POST /api/payments/verify - Verify payment after successful payment
router.post('/verify', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = 
    verifyPaymentSchema.parse(req.body);

  try {
    // Verify the payment signature
    const isValidSignature = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValidSignature) {
      logger.warn('Invalid payment signature detected', {
        razorpay_order_id,
        razorpay_payment_id,
        userId: req.user!.id,
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature. Payment verification failed.',
      });
    }

    // Find the order by Razorpay order ID
    const order = await prisma.order.findFirst({
      where: {
        paymentId: razorpay_order_id,
        userId: req.user!.id,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        table: {
          select: {
            number: true,
            location: true,
          },
        },
        items: {
          include: {
            menuItem: {
              select: {
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // Check if payment is already verified
    if (order.paymentStatus === 'COMPLETED') {
      const response: ApiResponse = {
        success: true,
        message: 'Payment already verified',
        data: { order },
      };
      return res.json(response);
    }

    try {
      // Fetch payment details from Razorpay to ensure payment is successful
      const paymentDetails = await fetchPaymentDetails(razorpay_payment_id);
      
      if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
        return res.status(400).json({
          success: false,
          error: 'Payment not successful',
        });
      }

      // Update order status to completed
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'COMPLETED',
          status: 'CONFIRMED',
          updatedAt: new Date(),
        },
        include: {
          table: {
            select: {
              number: true,
              location: true,
            },
          },
          items: {
            include: {
              menuItem: {
                select: {
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
      });

      logger.info('Payment verified successfully', {
        orderId: order.id,
        razorpay_order_id,
        razorpay_payment_id,
        userId: req.user!.id,
        amount: order.total,
      });

      // Automatically generate and send invoice after successful payment
      try {
        // Check if invoice already exists
        let invoice = await prisma.invoice.findUnique({
          where: { orderId: order.id },
        });

        // Generate unique invoice number if not exists
        const invoiceNumber = invoice?.invoiceNumber || 
          `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;

        // Prepare invoice data
        const invoiceData = {
          customerName: order.user.name,
          customerEmail: order.user.email,
          customerPhone: order.user.phone || '', // Handle null phone
          invoiceNumber,
          orderDate: order.createdAt.toLocaleDateString('en-IN'),
          items: order.items.map((item: any) => ({
            name: item.menuItem.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
          })),
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          tableNumber: order.table.number,
          restaurantName: process.env.APP_NAME || 'Restaurant',
          restaurantAddress: 'Your Restaurant Address Here',
          restaurantPhone: process.env.TWILIO_PHONE_NUMBER,
          paymentMethod: 'Online Payment (Razorpay)',
        };

        // Generate PDF
        const pdfBuffer = generateInvoicePDF(invoiceData);
        const pdfFileName = `invoice-${invoiceNumber}.pdf`;
        const pdfPath = await savePDFToStorage(pdfBuffer, pdfFileName);

        // Track delivery results
        const results = {
          emailSent: false,
          smsSent: false,
          pdfGenerated: true,
          pdfPath,
        };

        // Send email automatically
        if (order.user.email) {
          results.emailSent = await sendInvoiceEmail(
            order.user.email,
            {
              customerName: order.user.name,
              invoiceNumber,
              orderDate: invoiceData.orderDate,
              total: order.total,
              tableNumber: order.table.number,
              restaurantName: invoiceData.restaurantName,
            },
            pdfBuffer
          );
        }

        // Create or update invoice record
        if (!invoice) {
          invoice = await prisma.invoice.create({
            data: {
              orderId: order.id,
              invoiceNumber,
              sentVia: ['EMAIL'], // Default to email
              emailSent: results.emailSent,
              smsSent: results.smsSent,
              pdfPath: results.pdfPath,
            },
          });
        } else {
          // Update existing invoice
          const updatedSentVia = [...invoice.sentVia];
          if (!updatedSentVia.includes('EMAIL')) {
            updatedSentVia.push('EMAIL');
          }
          
          invoice = await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              sentVia: updatedSentVia,
              emailSent: invoice.emailSent || results.emailSent,
              smsSent: invoice.smsSent || results.smsSent,
              pdfPath: results.pdfPath,
            },
          });
        }

        logger.info('Invoice automatically generated and sent', {
          orderId: order.id,
          invoiceNumber,
          userId: req.user!.id,
          results,
        });
      } catch (invoiceError) {
        logger.error('Automatic invoice generation failed', {
          orderId: order.id,
          userId: req.user!.id,
          error: invoiceError instanceof Error ? invoiceError.message : 'Unknown error',
        });
        // Don't fail the payment process if invoice generation fails
      }

      const response: ApiResponse = {
        success: true,
        message: 'Payment verified successfully',
        data: {
          order: updatedOrder,
          paymentId: razorpay_payment_id,
        },
      };

      return res.json(response);
    } catch (error) {
      logger.error('Payment verification failed', {
        orderId: order.id,
        razorpay_order_id,
        razorpay_payment_id,
        userId: req.user!.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update order status to failed
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'FAILED',
          updatedAt: new Date(),
        },
      });

      return res.status(500).json({
        success: false,
        error: 'Payment verification failed',
      });
    }
  } catch (error) {
    logger.error('Unexpected error during payment verification', {
      userId: req.user!.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred during payment verification',
    });
  }
}));

// POST /api/payments/refund - Refund a payment
router.post('/refund', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { orderId, amount, reason } = refundPaymentSchema.parse(req.body);

  if (!orderId) {
    throw new AppError('Order ID is required', 400);
  }

  // Find the order
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: req.user!.id,
      paymentStatus: 'COMPLETED',
    },
  });

  if (!order) {
    throw new AppError('Order not found or payment not completed', 404);
  }

  if (!order.paymentId) {
    throw new AppError('No payment ID found for this order', 400);
  }

  try {
    // Get the payment ID from the order's payment reference
    // In a real implementation, you'd store the actual payment ID, not the order ID
    const paymentDetails = await fetchPaymentDetails(order.paymentId);
    
    // Process refund
    const refund = await refundRazorpayPayment(
      paymentDetails.id,
      amount || order.total,
      reason || 'Customer requested refund'
    );

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'REFUNDED',
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    });

    logger.info('Payment refunded successfully', {
      orderId,
      refundId: refund.id,
      amount: refund.amount,
      userId: req.user!.id,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Payment refunded successfully',
      data: {
        refundId: refund.id,
        amount: refund.amount ? refund.amount / 100 : 0, // Convert back from paisa
        status: refund.status,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error('Payment refund failed', {
      orderId,
      userId: req.user!.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new AppError('Failed to process refund', 500);
  }
}));

// GET /api/payments/status/:orderId - Get payment status for an order
router.get('/status/:orderId', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { orderId } = req.params;

  if (!orderId) {
    throw new AppError('Order ID is required', 400);
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: req.user!.id,
    },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paymentId: true,
      total: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  const response: ApiResponse = {
    success: true,
    data: { order },
  };

  res.json(response);
}));

export default router;