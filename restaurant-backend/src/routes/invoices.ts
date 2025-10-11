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

// POST /api/invoices/generate - Generate invoice for an order (separate from payment verification)
router.post('/generate', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { orderId, methods } = generateInvoiceSchema.parse(req.body);

  try {
    // Get the order with all necessary details
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
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

    // Generate PDF only when needed
    const pdfBuffer = generateInvoicePDF(invoiceData);
    const pdfStorageResult = await savePDFToStorage(pdfBuffer, `invoice-${invoiceNumber}.pdf`);

    // Track delivery results
    const results = {
      emailSent: false,
      smsSent: false,
      pdfGenerated: true,
      pdfPath: pdfStorageResult.pdfPath,
    };

    // Send via specified methods
    const sentVia: ('EMAIL' | 'SMS')[] = [];

    if (methods.includes('EMAIL') && order.user.email) {
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
      
      if (results.emailSent) {
        sentVia.push('EMAIL');
      }
    }

    // Create or update invoice record with PDF data using raw query due to type issues
    if (!invoice) {
      // Use raw query to insert PDF data since TypeScript types might not be updated
      const formattedSentVia = `{${sentVia.map(method => `"${method}"`).join(',')}}`;
      const newInvoiceId = require('crypto').randomBytes(16).toString('hex');
      
      await prisma.$executeRaw`
        INSERT INTO "invoices" 
        ("id", "orderId", "invoiceNumber", "sentVia", "emailSent", "smsSent", "pdfData", "pdfName")
        VALUES 
        ($1, $2, $3, $4::"InvoiceMethod"[], $5, $6, $7, $8)
      `,[newInvoiceId, order.id, invoiceNumber, formattedSentVia, results.emailSent, results.smsSent, pdfStorageResult.pdfData, pdfStorageResult.pdfName];
      
      // Get the created invoice
      invoice = await prisma.invoice.findUnique({
        where: { orderId: order.id },
      });
    } else {
      // Update existing invoice using raw query
      const updatedSentVia = [...invoice.sentVia, ...sentVia.filter(method => !invoice!.sentVia.includes(method as any))];
      
      // Properly format the array for PostgreSQL
      const formattedSentVia = `{${updatedSentVia.map(method => `"${method}"`).join(',')}}`;
      
      await prisma.$executeRaw`
        UPDATE "invoices" 
        SET "sentVia" = $1::"InvoiceMethod"[], 
            "emailSent" = $2, 
            "smsSent" = $3,
            "pdfData" = $4,
            "pdfName" = $5
        WHERE "id" = $6
      `,[formattedSentVia, invoice.emailSent || results.emailSent, invoice.smsSent || results.smsSent, pdfStorageResult.pdfData, pdfStorageResult.pdfName, invoice.id];
      
      // Get the updated invoice
      invoice = await prisma.invoice.findUnique({
        where: { id: invoice.id },
      });
    }

    logger.info('Invoice generated and sent', {
      orderId: order.id,
      invoiceNumber,
      userId: req.user!.id,
      methods,
      results,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Invoice generated and sent successfully',
      data: {
        invoice,
        results,
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Invoice generation failed', {
      orderId,
      userId: req.user!.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new AppError(
      error instanceof Error ? error.message : 'Failed to generate invoice',
      500
    );
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

  // Use raw query to get invoice with PDF data
  const invoices: any[] = await prisma.$queryRaw`
    SELECT i.*, o."userId"
    FROM "invoices" i
    JOIN "orders" o ON i."orderId" = o."id"
    WHERE i."id" = ${invoiceId} AND o."userId" = ${req.user!.id}
  `;

  if (!invoices || invoices.length === 0) {
    throw new AppError('Invoice not found', 404);
  }

  const invoice = invoices[0];

  // Get order details for resending
  const orderDetails = await prisma.order.findFirst({
    where: {
      id: invoice.orderId,
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
        },
      },
    },
  });

  if (!orderDetails) {
    throw new AppError('Order details not found', 404);
  }

  try {
    const results = {
      emailSent: false,
      smsSent: false,
    };

    // Prepare invoice data for resending
    const invoiceData = {
      customerName: orderDetails.user.name,
      invoiceNumber: invoice.invoiceNumber,
      orderDate: orderDetails.createdAt.toLocaleDateString('en-IN'),
      total: orderDetails.total,
      tableNumber: orderDetails.table.number,
      restaurantName: process.env.APP_NAME || 'Restaurant',
    };

    const deliveryMethods = methods || []; // Handle possible undefined

    // Send email if requested and we have PDF data
    if (deliveryMethods.includes('EMAIL') && orderDetails.user.email && invoice.pdfData) {
      // Convert stored PDF data back to buffer
      const pdfBuffer = invoice.pdfData;
      
      results.emailSent = await sendInvoiceEmail(
        orderDetails.user.email,
        invoiceData,
        pdfBuffer
      );
    }

    // Send SMS if requested
    if (deliveryMethods.includes('SMS') && orderDetails.user.phone) {
      results.smsSent = await sendInvoiceSMS(
        orderDetails.user.phone,
        invoiceData
      );
    }

    // Update invoice record using raw query
    const currentSentVia = invoice.sentVia || [];
    const updatedSentVia = [...new Set([...currentSentVia, ...deliveryMethods])];
    
    // Properly format the array for PostgreSQL
    const formattedSentVia = `{${updatedSentVia.map(method => `"${method}"`).join(',')}}`;
    
    await prisma.$executeRaw`
      UPDATE "invoices" 
      SET "sentVia" = $1::"InvoiceMethod"[], 
          "emailSent" = $2, 
          "smsSent" = $3
      WHERE "id" = $4
    `,[formattedSentVia, invoice.emailSent || results.emailSent, invoice.smsSent || results.smsSent, invoiceId];

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
        warnings: generateWarnings(deliveryMethods, orderDetails.user.email, orderDetails.user.phone, results, !!invoice.pdfData),
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
  results?: { emailSent: boolean; smsSent: boolean },
  hasPdfData?: boolean
): string[] {
  const warnings: string[] = [];

  if (methods.includes('EMAIL')) {
    if (!email) {
      warnings.push('Email delivery skipped: No email address available');
    } else if (!hasPdfData) {
      warnings.push('Email delivery skipped: No PDF data available');
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