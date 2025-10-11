"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const pdf_1 = require("../lib/pdf");
const email_1 = require("../lib/email");
const sms_1 = require("../lib/sms");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const generateInvoiceSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(1, 'Order ID is required'),
    methods: zod_1.z.array(zod_1.z.enum(['EMAIL', 'SMS'])).default([]),
});
router.post('/generate', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId, methods } = generateInvoiceSchema.parse(req.body);
    try {
        const order = await database_1.prisma.order.findFirst({
            where: {
                id: orderId,
                userId: req.user.id,
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
            throw new errorHandler_1.AppError('Order not found', 404);
        }
        let invoice = await database_1.prisma.invoice.findUnique({
            where: { orderId: order.id },
        });
        const invoiceNumber = invoice?.invoiceNumber ||
            `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;
        const invoiceData = {
            customerName: order.user.name,
            customerEmail: order.user.email,
            customerPhone: order.user.phone || '',
            invoiceNumber,
            orderDate: order.createdAt.toLocaleDateString('en-IN'),
            items: order.items.map((item) => ({
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
        const pdfBuffer = (0, pdf_1.generateInvoicePDF)(invoiceData);
        const pdfStorageResult = await (0, pdf_1.savePDFToStorage)(pdfBuffer, `invoice-${invoiceNumber}.pdf`);
        const results = {
            emailSent: false,
            smsSent: false,
            pdfGenerated: true,
            pdfPath: pdfStorageResult.pdfPath,
        };
        const sentVia = [];
        if (methods.includes('EMAIL') && order.user.email) {
            results.emailSent = await (0, email_1.sendInvoiceEmail)(order.user.email, {
                customerName: order.user.name,
                invoiceNumber,
                orderDate: invoiceData.orderDate,
                total: order.total,
                tableNumber: order.table.number,
                restaurantName: invoiceData.restaurantName,
            }, pdfBuffer);
            if (results.emailSent) {
                sentVia.push('EMAIL');
            }
        }
        if (!invoice) {
            await database_1.prisma.$executeRaw `
        INSERT INTO "invoices" 
        ("id", "orderId", "invoiceNumber", "sentVia", "emailSent", "smsSent", "pdfData", "pdfName")
        VALUES 
        (${require('crypto').randomBytes(16).toString('hex')}, ${order.id}, ${invoiceNumber}, ${JSON.stringify(sentVia)}, ${results.emailSent}, ${results.smsSent}, ${pdfStorageResult.pdfData}, ${pdfStorageResult.pdfName})
      `;
            invoice = await database_1.prisma.invoice.findUnique({
                where: { orderId: order.id },
            });
        }
        else {
            const updatedSentVia = [...invoice.sentVia, ...sentVia.filter(method => !invoice.sentVia.includes(method))];
            await database_1.prisma.$executeRaw `
        UPDATE "invoices" 
        SET "sentVia" = ${JSON.stringify(updatedSentVia)}, 
            "emailSent" = ${invoice.emailSent || results.emailSent}, 
            "smsSent" = ${invoice.smsSent || results.smsSent},
            "pdfData" = ${pdfStorageResult.pdfData},
            "pdfName" = ${pdfStorageResult.pdfName}
        WHERE "id" = ${invoice.id}
      `;
            invoice = await database_1.prisma.invoice.findUnique({
                where: { id: invoice.id },
            });
        }
        logger_1.logger.info('Invoice generated and sent', {
            orderId: order.id,
            invoiceNumber,
            userId: req.user.id,
            methods,
            results,
        });
        const response = {
            success: true,
            message: 'Invoice generated and sent successfully',
            data: {
                invoice,
                results,
            },
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Invoice generation failed', {
            orderId,
            userId: req.user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new errorHandler_1.AppError(error instanceof Error ? error.message : 'Failed to generate invoice', 500);
    }
}));
router.get('/:orderId', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId } = req.params;
    if (!orderId) {
        throw new errorHandler_1.AppError('Order ID is required', 400);
    }
    const invoice = await database_1.prisma.invoice.findFirst({
        where: {
            orderId,
            order: {
                userId: req.user.id,
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
        throw new errorHandler_1.AppError('Invoice not found', 404);
    }
    const response = {
        success: true,
        data: { invoice },
    };
    res.json(response);
}));
router.get('/user/list', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const invoices = await database_1.prisma.invoice.findMany({
        where: {
            order: {
                userId: req.user.id,
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
    const response = {
        success: true,
        data: { invoices },
    };
    res.json(response);
}));
router.post('/:invoiceId/resend', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { invoiceId } = req.params;
    const { methods } = zod_1.z.object({
        methods: zod_1.z.array(zod_1.z.enum(['EMAIL', 'SMS'])).default([]),
    }).parse(req.body);
    if (!invoiceId) {
        throw new errorHandler_1.AppError('Invoice ID is required', 400);
    }
    const invoices = await database_1.prisma.$queryRaw `
    SELECT i.*, o."userId"
    FROM "invoices" i
    JOIN "orders" o ON i."orderId" = o."id"
    WHERE i."id" = ${invoiceId} AND o."userId" = ${req.user.id}
  `;
    if (!invoices || invoices.length === 0) {
        throw new errorHandler_1.AppError('Invoice not found', 404);
    }
    const invoice = invoices[0];
    const orderDetails = await database_1.prisma.order.findFirst({
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
        throw new errorHandler_1.AppError('Order details not found', 404);
    }
    try {
        const results = {
            emailSent: false,
            smsSent: false,
        };
        const invoiceData = {
            customerName: orderDetails.user.name,
            invoiceNumber: invoice.invoiceNumber,
            orderDate: orderDetails.createdAt.toLocaleDateString('en-IN'),
            total: orderDetails.total,
            tableNumber: orderDetails.table.number,
            restaurantName: process.env.APP_NAME || 'Restaurant',
        };
        const deliveryMethods = methods || [];
        if (deliveryMethods.includes('EMAIL') && orderDetails.user.email && invoice.pdfData) {
            const pdfBuffer = invoice.pdfData;
            results.emailSent = await (0, email_1.sendInvoiceEmail)(orderDetails.user.email, invoiceData, pdfBuffer);
        }
        if (deliveryMethods.includes('SMS') && orderDetails.user.phone) {
            results.smsSent = await (0, sms_1.sendInvoiceSMS)(orderDetails.user.phone, invoiceData);
        }
        const currentSentVia = invoice.sentVia || [];
        const updatedSentVia = [...new Set([...currentSentVia, ...deliveryMethods])];
        await database_1.prisma.$executeRaw `
      UPDATE "invoices" 
      SET "sentVia" = ${JSON.stringify(updatedSentVia)}, 
          "emailSent" = ${invoice.emailSent || results.emailSent}, 
          "smsSent" = ${invoice.smsSent || results.smsSent}
      WHERE "id" = ${invoiceId}
    `;
        logger_1.logger.info('Invoice resent successfully', {
            invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            userId: req.user.id,
            methods: deliveryMethods,
            results,
        });
        const response = {
            success: true,
            message: 'Invoice resent successfully',
            data: {
                deliveryResults: results,
                warnings: generateWarnings(deliveryMethods, orderDetails.user.email, orderDetails.user.phone, results, !!invoice.pdfData),
            },
        };
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Invoice resend failed', {
            invoiceId,
            userId: req.user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new errorHandler_1.AppError('Failed to resend invoice', 500);
    }
}));
function generateWarnings(methods, email, phone, results, hasPdfData) {
    const warnings = [];
    if (methods.includes('EMAIL')) {
        if (!email) {
            warnings.push('Email delivery skipped: No email address available');
        }
        else if (!hasPdfData) {
            warnings.push('Email delivery skipped: No PDF data available');
        }
        else if (results && !results.emailSent) {
            warnings.push('Email delivery failed: Please check email configuration');
        }
    }
    if (methods.includes('SMS')) {
        if (!phone) {
            warnings.push('SMS delivery skipped: No phone number available');
        }
        else if (results && !results.smsSent) {
            warnings.push('SMS delivery failed: Please check SMS configuration');
        }
    }
    return warnings;
}
exports.default = router;
//# sourceMappingURL=invoices.js.map