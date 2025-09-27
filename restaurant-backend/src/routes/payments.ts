import { Router, Response } from 'express';
import { z } from 'zod';
import { getPrismaClient } from '../config/database'; // Use lazy initialization
import { authenticate } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { 
  createRazorpayOrder, 
  verifyRazorpaySignature,
  fetchPaymentDetails,
  refundRazorpayPayment 
} from '../lib/razorpay';
import { AuthenticatedRequest, ApiResponse } from '../types/api';
import { logger } from '../utils/logger';
import { generateInvoicePDF, savePDFToStorage } from '../lib/pdf';
import { sendInvoiceEmail } from '../lib/email';
// Removed unused import
// import { sendInvoiceSMS } from '../lib/sms';

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
  const prisma = getPrismaClient(); // Lazy initialization
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
  const prisma = getPrismaClient(); // Lazy initialization
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = 
    verifyPaymentSchema.parse(req.body);

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
    
    throw new AppError('Invalid payment signature. Payment verification failed.', 400);
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
    throw new AppError('Order not found', 404);
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
    
    // Update order status to completed
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'COMPLETED',
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

    // Prepare invoice data
    const invoiceData = {
      customerName: updatedOrder.user.name,
      customerEmail: updatedOrder.user.email,
      customerPhone: updatedOrder.user.phone || '',
      invoiceNumber: `INV-${Date.now()}-${updatedOrder.id.substring(0, 8).toUpperCase()}`,
      orderDate: updatedOrder.createdAt.toLocaleDateString('en-IN'),
      items: updatedOrder.items.map((item: any) => ({
        name: item.menuItem.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
      })),
      subtotal: updatedOrder.subtotal,
      tax: updatedOrder.tax,
      total: updatedOrder.total,
      tableNumber: updatedOrder.table.number,
      restaurantName: process.env.APP_NAME || 'Restaurant',
      restaurantAddress: 'Your Restaurant Address Here',
      restaurantPhone: process.env.TWILIO_PHONE_NUMBER,
      paymentMethod: 'Online Payment (Razorpay)',
    };

    // Generate invoice PDF
    const invoicePDF = await generateInvoicePDF(invoiceData);
    
    // Save PDF to storage
    const invoiceUrl = await savePDFToStorage(invoicePDF, `invoice_${updatedOrder.id}.pdf`);
    
    // Send invoice email asynchronously (non-blocking)
    sendInvoiceEmail(
      updatedOrder.user.email,
      {
        customerName: updatedOrder.user.name,
        invoiceNumber: invoiceData.invoiceNumber,
        orderDate: invoiceData.orderDate,
        total: updatedOrder.total,
        tableNumber: updatedOrder.table.number,
        restaurantName: invoiceData.restaurantName,
      },
      invoicePDF
    ).catch(error => {
      logger.error('Failed to send invoice email (non-critical)', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orderId: updatedOrder.id,
        email: updatedOrder.user.email,
      });
    });

    logger.info('Payment verified successfully', {
      orderId: order.id,
      razorpayPaymentId: razorpay_payment_id,
      userId: req.user!.id,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Payment verified successfully',
      data: {
        order: updatedOrder,
        invoiceUrl,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error('Payment verification failed', {
      orderId: order.id,
      razorpayPaymentId: razorpay_payment_id,
      userId: req.user!.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Update order status to failed
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'FAILED' },
    });

    throw new AppError('Payment verification failed', 500);
  }
}));

// GET /api/payments/status/:orderId - Get payment status
router.get('/status/:orderId', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
  const { orderId } = req.params;

  // Validate orderId
  if (!orderId) {
    throw new AppError('Order ID is required', 400);
  }

  // Get the order and verify it belongs to the user
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: req.user!.id,
    },
    select: {
      id: true,
      paymentStatus: true,
      total: true,
      createdAt: true,
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  const response: ApiResponse = {
    success: true,
    data: { order },
  };

  return res.json(response);
}));

// POST /api/payments/refund - Refund a payment
router.post('/refund', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
  const { orderId, amount, reason } = refundPaymentSchema.parse(req.body);

  // Get the order and verify it belongs to the user
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: req.user!.id,
      paymentStatus: 'COMPLETED',
    },
  });

  if (!order) {
    throw new AppError('Completed order not found', 404);
  }

  if (!order.paymentId) {
    throw new AppError('Payment ID not found for this order', 400);
  }

  try {
    // Perform refund through Razorpay
    // Fix the function call with correct parameters
    const refund = await refundRazorpayPayment(
      order.paymentId,
      amount || order.total, // Refund full amount if not specified
      reason || 'Customer requested refund'
    );

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'REFUNDED',
      },
    });

    logger.info('Payment refunded successfully', {
      orderId,
      amount: refund.amount,
      userId: req.user!.id,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Payment refunded successfully',
      data: { refund },
    };

    return res.json(response);
  } catch (error) {
    logger.error('Payment refund failed', {
      orderId,
      paymentId: order.paymentId,
      userId: req.user!.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new AppError('Failed to process refund', 500);
  }
}));

export default router;