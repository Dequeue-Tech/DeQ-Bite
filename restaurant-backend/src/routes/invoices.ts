import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { AppError, asyncHandler } from '@/middleware/errorHandler';
import { generateInvoicePDF, savePDFToStorage } from '@/lib/pdf';
import { sendInvoiceEmail } from '@/lib/email';
import { sendInvoiceSMS } from '@/lib/sms';
import { AuthenticatedRequest, ApiResponse } from '@/types/api';
import { logger } from '@/utils/logger';

const router = Router();

// Validation schemas
const generateInvoiceSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  methods: z.array(z.enum(['EMAIL', 'SMS'])).default([]), // Default to empty array
});

// POST /api/invoices/generate - Generate and send invoice
router.post('/generate', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { orderId, methods } = generateInvoiceSchema.parse(req.body);

  // Get the order with all related data - only completed payments
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: req.user!.id,
      paymentStatus: 'COMPLETED', // Only allow invoice generation for completed payments
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
    throw new AppError('Order not found or payment not completed', 404);
  }

  try {
    // Check if invoice already exists
    let invoice = await prisma.invoice.findUnique({
      where: { orderId },
    });

    // If invoice already exists and was automatically generated, return it
    if (invoice && invoice.sentVia.length > 0) {
      logger.info('Invoice already exists and was sent automatically', {
        orderId,
        invoiceId: invoice.id,
        sentVia: invoice.sentVia,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Invoice already generated and sent',
        data: {
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            pdfUrl: invoice.pdfPath,
            sentVia: invoice.sentVia,
            emailSent: invoice.emailSent,
            smsSent: invoice.smsSent,
            issuedAt: invoice.issuedAt,
          },
          deliveryResults: {
            emailSent: invoice.emailSent,
            smsSent: invoice.smsSent,
            pdfGenerated: true,
            pdfPath: invoice.pdfPath,
          },
        },
      };

      return res.status(200).json(response);
    }

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

    const deliveryMethods = methods || []; // Handle possible undefined

    // Send email if requested and email is available
    if (deliveryMethods.includes('EMAIL') && order.user.email) {
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

    // Send SMS if requested and phone is available
    if (deliveryMethods.includes('SMS') && order.user.phone) {
      results.smsSent = await sendInvoiceSMS(
        order.user.phone,
        {
          customerName: order.user.name,
          invoiceNumber,
          total: order.total,
          restaurantName: invoiceData.restaurantName,
        }
      );
    }

    // Create or update invoice record
    if (!invoice) {
      invoice = await prisma.invoice.create({
        data: {
          orderId,
          invoiceNumber,
          sentVia: deliveryMethods,
          emailSent: results.emailSent,
          smsSent: results.smsSent,
          pdfPath: results.pdfPath,
        },
      });
    } else {
      // Update existing invoice with new delivery methods
      const updatedSentVia = [...new Set([...invoice.sentVia, ...deliveryMethods])];
      
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

    logger.info('Invoice generated and delivered', {
      orderId,
      invoiceNumber,
      userId: req.user!.id,
      methods,
      results,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Invoice generated and delivered successfully',
      data: {
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          pdfUrl: results.pdfPath,
          sentVia: invoice.sentVia,
          emailSent: invoice.emailSent,
          smsSent: invoice.smsSent,
          issuedAt: invoice.issuedAt,
        },
        deliveryResults: results,
        warnings: generateWarnings(deliveryMethods, order.user.email, order.user.phone, results),
      },
    };

    return res.status(201).json(response);
  } catch (error) {
    logger.error('Invoice generation failed', {
      orderId,
      userId: req.user!.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new AppError('Failed to generate invoice', 500);
  }
}));

// GET /api/invoices/:orderId - Get invoice for an order
router.get('/:orderId', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { orderId } = req.params;

  if (!orderId) {
    throw new AppError('Order ID is required', 400);
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      orderId,
      order: {
        userId: req.user!.id,
      },
    },
    include: {
      order: {
        select: {
          id: true,
          total: true,
          paymentStatus: true,
          status: true,
          createdAt: true,
          table: {
            select: {
              number: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  const response: ApiResponse = {
    success: true,
    data: { invoice },
  };

  res.json(response);
}));

// GET /api/invoices/user/list - Get all invoices for authenticated user
router.get('/user/list', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const invoices = await prisma.invoice.findMany({
    where: {
      order: {
        userId: req.user!.id,
      },
    },
    include: {
      order: {
        select: {
          id: true,
          total: true,
          paymentStatus: true,
          status: true,
          createdAt: true,
          table: {
            select: {
              number: true,
            },
          },
        },
      },
    },
    orderBy: {
      issuedAt: 'desc',
    },
  });

  const response: ApiResponse = {
    success: true,
    data: { invoices },
  };

  res.json(response);
}));

// POST /api/invoices/:invoiceId/resend - Resend invoice
router.post('/:invoiceId/resend', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { invoiceId } = req.params;
  const { methods } = z.object({
    methods: z.array(z.enum(['EMAIL', 'SMS'])).default([]), // Default to empty array
  }).parse(req.body);

  if (!invoiceId) {
    throw new AppError('Invoice ID is required', 400);
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      order: {
        userId: req.user!.id,
      },
    },
    include: {
      order: {
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
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  try {
    const results = {
      emailSent: false,
      smsSent: false,
    };

    // Prepare invoice data for resending
    const invoiceData = {
      customerName: invoice.order.user.name,
      invoiceNumber: invoice.invoiceNumber,
      orderDate: invoice.order.createdAt.toLocaleDateString('en-IN'),
      total: invoice.order.total,
      tableNumber: invoice.order.table.number,
      restaurantName: process.env.APP_NAME || 'Restaurant',
    };

    const deliveryMethods = methods || []; // Handle possible undefined

    // Send email if requested
    if (deliveryMethods.includes('EMAIL') && invoice.order.user.email) {
      // For resending, we need to regenerate the PDF or read from storage
      const pdfBuffer = generateInvoicePDF({
        ...invoiceData,
        items: [], // Would need to fetch items again or store in invoice
        subtotal: invoice.order.subtotal,
        tax: invoice.order.tax,
        customerEmail: invoice.order.user.email,
        customerPhone: invoice.order.user.phone || '', // Handle null phone
      });

      results.emailSent = await sendInvoiceEmail(
        invoice.order.user.email,
        invoiceData,
        pdfBuffer
      );
    }

    // Send SMS if requested
    if (deliveryMethods.includes('SMS') && invoice.order.user.phone) {
      results.smsSent = await sendInvoiceSMS(
        invoice.order.user.phone,
        invoiceData
      );
    }

    // Update invoice record
    const updatedSentVia = [...new Set([...invoice.sentVia, ...deliveryMethods])];
    
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        sentVia: updatedSentVia,
        emailSent: invoice.emailSent || results.emailSent,
        smsSent: invoice.smsSent || results.smsSent,
      },
    });

    logger.info('Invoice resent successfully', {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      userId: req.user!.id,
      methods: deliveryMethods,
      results,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Invoice resent successfully',
      data: {
        deliveryResults: results,
        warnings: generateWarnings(deliveryMethods, invoice.order.user.email, invoice.order.user.phone, results),
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Invoice resend failed', {
      invoiceId,
      userId: req.user!.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new AppError('Failed to resend invoice', 500);
  }
}));

/**
 * Generate warning messages for delivery issues
 */
function generateWarnings(
  methods: string[],
  email?: string | null,
  phone?: string | null,
  results?: { emailSent: boolean; smsSent: boolean }
): string[] {
  const warnings: string[] = [];

  if (methods.includes('EMAIL')) {
    if (!email) {
      warnings.push('Email delivery skipped: No email address available');
    } else if (results && !results.emailSent) {
      warnings.push('Email delivery failed: Please check email configuration');
    }
  }

  if (methods.includes('SMS')) {
    if (!phone) {
      warnings.push('SMS delivery skipped: No phone number available');
    } else if (results && !results.smsSent) {
      warnings.push('SMS delivery failed: Please check SMS configuration');
    }
  }

  return warnings;
}

export default router;