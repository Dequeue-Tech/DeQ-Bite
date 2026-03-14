import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate } from '@/middleware/auth';
import { requireRestaurant } from '@/middleware/restaurant';
import { AppError, asyncHandler } from '@/middleware/errorHandler';
import { generateInvoicePDF, savePDFToStorage } from '@/lib/pdf';
import { sendInvoiceEmail } from '@/lib/email';
import { sendInvoiceSMS } from '@/lib/sms';
import { AuthenticatedRequest, ApiResponse } from '@/types/api';
import { logger } from '@/utils/logger';
import { accelerateCache } from '@/utils/accelerate-cache';

const router = Router();

// Validation schemas
const generateInvoiceSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  methods: z.array(z.enum(['EMAIL', 'SMS'])).default([]), // Default to empty array
});

// POST /api/invoices/generate - Generate and send invoice
router.post('/generate', authenticate, requireRestaurant, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { orderId, methods } = generateInvoiceSchema.parse(req.body);

  // Get the order with all related data - only completed payments
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: req.user!.id,
      restaurantId: req.restaurant!.id,
      paymentStatus: 'COMPLETED', // Only allow invoice generation for completed payments
    },
    include: {
      restaurant: {
        select: {
          name: true,
          address: true,
          city: true,
          state: true,
          phone: true,
          email: true,
          gstNumber: true,
        },
      },
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
              pricePaise: true,
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
    const taxPercent = order.subtotalPaise > 0
      ? Math.round((order.taxPaise / order.subtotalPaise) * 100)
      : undefined;
    const invoiceData = {
      // Restaurant fields — from DB
      restaurantName: order.restaurant.name,
      ...(order.restaurant.address   ? { restaurantAddress: order.restaurant.address }   : {}),
      ...(order.restaurant.city      ? { restaurantCity:    order.restaurant.city }       : {}),
      ...(order.restaurant.state     ? { restaurantState:   order.restaurant.state }      : {}),
      ...(order.restaurant.phone     ? { restaurantPhone:   order.restaurant.phone }      : {}),
      ...(order.restaurant.email     ? { restaurantEmail:   order.restaurant.email }      : {}),
      ...(order.restaurant.gstNumber ? { gstNumber:         order.restaurant.gstNumber }  : {}),
      ...(taxPercent !== undefined   ? { taxPercent }                                      : {}),
      // Order fields
      customerName: order.user.name,
      customerEmail: order.user.email,
      ...(order.user.phone ? { customerPhone: order.user.phone } : {}),
      invoiceNumber,
      orderDate: order.createdAt.toLocaleDateString('en-IN'),
      items: order.items.map((item: any) => ({
        name: item.menuItem.name,
        quantity: item.quantity,
        price: item.pricePaise / 100,
        total: (item.pricePaise * item.quantity) / 100,
      })),
      subtotal: order.subtotalPaise / 100,
      tax: order.taxPaise / 100,
      total: order.totalPaise / 100,
      tableNumber: order.table.number,
      paymentMethod: `${order.paymentProvider || 'RAZORPAY'}`,
    };

    // Generate PDF
    const pdfBuffer = generateInvoicePDF(invoiceData);
    const pdfFileName = `invoice-${invoiceNumber}.pdf`;
    const pdfStorageResult = await savePDFToStorage(pdfBuffer, pdfFileName);

    // Track delivery results
    const results = {
      emailSent: false,
      smsSent: false,
      pdfGenerated: true,
      pdfPath: pdfStorageResult.pdfPath,
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
          total: order.totalPaise / 100,
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
          total: order.totalPaise / 100,
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
          pdfPath: pdfStorageResult.pdfPath,
          pdfData: pdfStorageResult.pdfData,
          pdfName: pdfStorageResult.pdfName,
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
          pdfPath: pdfStorageResult.pdfPath,
          pdfData: pdfStorageResult.pdfData,
          pdfName: pdfStorageResult.pdfName,
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
router.get('/:orderId', authenticate, requireRestaurant, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { orderId } = req.params;

  if (!orderId) {
    throw new AppError('Order ID is required', 400);
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      orderId,
      order: {
        userId: req.user!.id,
        restaurantId: req.restaurant!.id,
      },
    },
    include: {
      order: {
        select: {
          id: true,
          totalPaise: true,
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
    ...(accelerateCache(120, 300) as any),
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
router.get('/user/list', authenticate, requireRestaurant, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const take = typeof req.query.take !== 'undefined' ? Math.min(Number(req.query.take) || 0, 100) : undefined;
  const cursor = req.query.cursor ? { id: String(req.query.cursor) } : undefined;

  const invoices = await prisma.invoice.findMany({
    where: {
      order: {
        userId: req.user!.id,
        restaurantId: req.restaurant!.id,
      },
    },
    include: {
      order: {
        select: {
          id: true,
          totalPaise: true,
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
    ...(accelerateCache(120, 300) as any),
    ...(typeof take === 'number' ? { take } : {}),
    ...(cursor ? { cursor, skip: 1 } : {}),
  });

  const response: ApiResponse = {
    success: true,
    data: { invoices },
  };

  res.json(response);
}));

// POST /api/invoices/:invoiceId/resend - Resend invoice
router.post('/:invoiceId/resend', authenticate, requireRestaurant, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
        restaurantId: req.restaurant!.id,
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
          restaurant: {
            select: {
              name: true,
              address: true,
              city: true,
              state: true,
              phone: true,
              email: true,
              gstNumber: true,
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
    const resendRestaurantName = invoice.order.restaurant?.name ?? 'Restaurant';
    const invoiceData = {
      customerName: invoice.order.user.name,
      invoiceNumber: invoice.invoiceNumber,
      orderDate: invoice.order.createdAt.toLocaleDateString('en-IN'),
      total: invoice.order.totalPaise / 100,
      tableNumber: invoice.order.table.number,
      restaurantName: resendRestaurantName,
    };

    const deliveryMethods = methods || []; // Handle possible undefined

    // Send email if requested
    if (deliveryMethods.includes('EMAIL') && invoice.order.user.email) {
      // For resending, we need to regenerate the PDF or read from storage
      const resendTaxPercent = invoice.order.subtotalPaise > 0
        ? Math.round((invoice.order.taxPaise / invoice.order.subtotalPaise) * 100)
        : undefined;
      const pdfBuffer = generateInvoicePDF({
        ...(invoice.order.restaurant?.address   ? { restaurantAddress: invoice.order.restaurant.address }  : {}),
        ...(invoice.order.restaurant?.city      ? { restaurantCity:    invoice.order.restaurant.city }      : {}),
        ...(invoice.order.restaurant?.state     ? { restaurantState:   invoice.order.restaurant.state }     : {}),
        ...(invoice.order.restaurant?.phone     ? { restaurantPhone:   invoice.order.restaurant.phone }     : {}),
        ...(invoice.order.restaurant?.gstNumber ? { gstNumber:         invoice.order.restaurant.gstNumber } : {}),
        ...(resendTaxPercent !== undefined       ? { taxPercent: resendTaxPercent }                          : {}),
        ...invoiceData,
        items: [],
        subtotal: invoice.order.subtotalPaise / 100,
        tax: invoice.order.taxPaise / 100,
        customerEmail: invoice.order.user.email,
        ...(invoice.order.user.phone ? { customerPhone: invoice.order.user.phone } : {}),
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

// POST /api/invoices/:invoiceOrOrderId/refresh-pdf - Regenerate and store PDF (by invoice or order id)
router.post('/:invoiceOrOrderId/refresh-pdf', authenticate, requireRestaurant, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { invoiceOrOrderId } = req.params;

  if (!invoiceOrOrderId) {
    throw new AppError('Invoice or Order ID is required', 400);
  }

  // Resolve invoice by id or by order id
  let invoice = await prisma.invoice.findFirst({
    where: {
      OR: [
        { id: invoiceOrOrderId },
        { orderId: invoiceOrOrderId },
      ],
      order: { userId: req.user!.id, restaurantId: req.restaurant!.id },
    },
    include: {
      order: {
        include: {
          items: { include: { menuItem: { select: { name: true, pricePaise: true } } } },
          table: true,
          user: true,
          restaurant: {
            select: {
              name: true, address: true, city: true,
              state: true, phone: true, email: true, gstNumber: true,
            },
          },
        },
      },
    },
  });

  // If not found, try to create invoice record for the order (must be owned and paid)
  if (!invoice) {
    const order = await prisma.order.findFirst({
      where: {
        id: invoiceOrOrderId,
        userId: req.user!.id,
        restaurantId: req.restaurant!.id,
        paymentStatus: 'COMPLETED',
      },
      include: {
        items: { include: { menuItem: { select: { name: true, pricePaise: true } } } },
        table: true,
        user: true,
        restaurant: {
          select: {
            name: true, address: true, city: true,
            state: true, phone: true, email: true, gstNumber: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError('Invoice not found', 404);
    }

    const invoiceNumber = `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;
    invoice = await prisma.invoice.create({
      data: { orderId: order.id, invoiceNumber },
      include: {
        order: {
          include: {
            items: { include: { menuItem: { select: { name: true, pricePaise: true } } } },
            table: true,
            user: true,
            restaurant: {
              select: {
                name: true, address: true, city: true,
                state: true, phone: true, email: true, gstNumber: true,
              },
            },
          },
        },
      },
    });
  }

  const order = invoice.order;
  if (!order) throw new AppError('Order not found for invoice', 404);

  const rfTaxPercent = order.subtotalPaise > 0
    ? Math.round((order.taxPaise / order.subtotalPaise) * 100)
    : undefined;
  const invoiceData = {
    restaurantName: order.restaurant?.name ?? 'Restaurant',
    ...(order.restaurant?.address   ? { restaurantAddress: order.restaurant.address }  : {}),
    ...(order.restaurant?.city      ? { restaurantCity:    order.restaurant.city }      : {}),
    ...(order.restaurant?.state     ? { restaurantState:   order.restaurant.state }     : {}),
    ...(order.restaurant?.phone     ? { restaurantPhone:   order.restaurant.phone }     : {}),
    ...(order.restaurant?.email     ? { restaurantEmail:   order.restaurant.email }     : {}),
    ...(order.restaurant?.gstNumber ? { gstNumber:         order.restaurant.gstNumber } : {}),
    ...(rfTaxPercent !== undefined  ? { taxPercent: rfTaxPercent }                      : {}),
    customerName: order.user?.name || '',
    customerEmail: order.user?.email || '',
    ...(order.user?.phone ? { customerPhone: order.user.phone } : {}),
    invoiceNumber: invoice.invoiceNumber,
    orderDate: order.createdAt.toLocaleDateString('en-IN'),
    items: (order.items || []).map((it: any) => ({
      name: it.menuItem?.name || 'Item',
      quantity: it.quantity,
      price: it.pricePaise / 100,
      total: (it.pricePaise * it.quantity) / 100,
    })),
    subtotal: order.subtotalPaise / 100,
    tax: order.taxPaise / 100,
    total: order.totalPaise / 100,
    tableNumber: order.table?.number || 0,
    paymentMethod: `${order.paymentProvider || 'RAZORPAY'}`,
  };

  // Generate and save PDF
  const pdfBuffer = generateInvoicePDF(invoiceData);
  const pdfFileName = `invoice-${invoice.invoiceNumber}.pdf`;
  const pdfStorageResult = await savePDFToStorage(pdfBuffer, pdfFileName);

  // Update invoice record
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      pdfPath: pdfStorageResult.pdfPath,
      pdfData: pdfStorageResult.pdfData,
      pdfName: pdfStorageResult.pdfName,
    },
  });

  const response: ApiResponse = {
    success: true,
    message: 'Invoice PDF regenerated and stored',
    data: {
      invoice: {
        id: updated.id,
        invoiceNumber: updated.invoiceNumber,
        pdfUrl: updated.pdfPath,
        pdfName: updated.pdfName,
      },
    },
  };

  res.json(response);
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
