import { Router, Response } from 'express';
import { z } from 'zod';
import { getPrismaClient } from '../config/database'; // Use lazy initialization
import { authenticate } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { generateInvoicePDF, savePDFToStorage } from '../lib/pdf';
import { sendInvoiceEmail } from '../lib/email';
import { sendInvoiceSMS } from '../lib/sms';
import { AuthenticatedRequest, ApiResponse } from '../types/api';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const generateInvoiceSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  methods: z.array(z.enum(['EMAIL', 'SMS'])).default([]), // Default to empty array
});

// POST /api/invoices/generate - Generate and send invoice
router.post('/generate', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
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

    // Send email if requested and email is available (non-blocking)
    if (deliveryMethods.includes('EMAIL') && order.user.email) {
      sendInvoiceEmail(
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
      ).then(emailSent => {
        logger.info('Invoice email sent', {
          orderId,
          email: order.user.email,
          success: emailSent,
        });
      }).catch(error => {
        logger.error('Failed to send invoice email (non-critical)', {
          error: error instanceof Error ? error.message : 'Unknown error',
          orderId,
          email: order.user.email,
        });
      });
      results.emailSent = true; // Optimistically assume it will be sent
    }

    // Send SMS if requested and phone is available (non-blocking)
    if (deliveryMethods.includes('SMS') && order.user.phone) {
      sendInvoiceSMS(
        order.user.phone,
        {
          customerName: order.user.name,
          invoiceNumber,
          total: order.total,
          restaurantName: invoiceData.restaurantName,
        }
      ).then(smsSent => {
        logger.info('Invoice SMS sent', {
          orderId,
          phone: order.user.phone,
          success: smsSent,
        });
      }).catch(error => {
        logger.error('Failed to send invoice SMS (non-critical)', {
          error: error instanceof Error ? error.message : 'Unknown error',
          orderId,
          phone: order.user.phone,
        });
      });
      results.smsSent = true; // Optimistically assume it will be sent
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
      invoiceId: invoice.id,
      deliveryResults: results,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Invoice generated successfully',
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
        deliveryResults: results,
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

// GET /api/invoices - Get all invoices for authenticated user
router.get('/', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
  
  const invoices = await prisma.invoice.findMany({
    where: {
      order: {
        userId: req.user!.id,
      },
    },
    orderBy: {
      issuedAt: 'desc',
    },
    include: {
      order: {
        select: {
          total: true,
          table: {
            select: {
              number: true,
            },
          },
        },
      },
    },
  });

  const response: ApiResponse = {
    success: true,
    data: {
      invoices: invoices.map(invoice => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        pdfUrl: invoice.pdfPath,
        sentVia: invoice.sentVia,
        emailSent: invoice.emailSent,
        smsSent: invoice.smsSent,
        issuedAt: invoice.issuedAt,
        orderTotal: invoice.order?.total,
        tableNumber: invoice.order?.table?.number,
      })),
    },
  };

  return res.json(response);
}));

// GET /api/invoices/:id - Get specific invoice
router.get('/:id', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
  const { id } = req.params;

  // Validate ID
  if (!id) {
    throw new AppError('Invoice ID is required', 400);
  }

  const invoice = await prisma.invoice.findUnique({
    where: {
      id,
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

  return res.json(response);
}));

// GET /api/invoices/order/:orderId - Get invoice by order ID
router.get('/order/:orderId', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const prisma = getPrismaClient(); // Lazy initialization
  const { orderId } = req.params;

  // Validate orderId
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
  });

  if (!invoice) {
    throw new AppError('Invoice not found for this order', 404);
  }

  const response: ApiResponse = {
    success: true,
    data: { invoice },
  };

  return res.json(response);
}));

export default router;