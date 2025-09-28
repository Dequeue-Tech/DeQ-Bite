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
    const prisma = (0, database_1.getPrismaClient)();
    const { orderId, methods } = generateInvoiceSchema.parse(req.body);
    const order = await prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
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
    if (!order) {
        throw new errorHandler_1.AppError('Order not found or payment not completed', 404);
    }
    try {
        let invoice = await prisma.invoice.findUnique({
            where: { orderId },
        });
        if (invoice && invoice.sentVia.length > 0) {
            logger_1.logger.info('Invoice already exists and was sent automatically', {
                orderId,
                invoiceId: invoice.id,
                sentVia: invoice.sentVia,
            });
            const response = {
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
        const pdfFileName = `invoice-${invoiceNumber}.pdf`;
        const pdfPath = await (0, pdf_1.savePDFToStorage)(pdfBuffer, pdfFileName);
        const results = {
            emailSent: false,
            smsSent: false,
            pdfGenerated: true,
            pdfPath,
        };
        const deliveryMethods = methods || [];
        if (deliveryMethods.includes('EMAIL') && order.user.email) {
            (0, email_1.sendInvoiceEmail)(order.user.email, {
                customerName: order.user.name,
                invoiceNumber,
                orderDate: invoiceData.orderDate,
                total: order.total,
                tableNumber: order.table.number,
                restaurantName: invoiceData.restaurantName,
            }, pdfBuffer).then(emailSent => {
                logger_1.logger.info('Invoice email sent', {
                    orderId,
                    email: order.user.email,
                    success: emailSent,
                });
            }).catch(error => {
                logger_1.logger.error('Failed to send invoice email (non-critical)', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    orderId,
                    email: order.user.email,
                });
            });
            results.emailSent = true;
        }
        if (deliveryMethods.includes('SMS') && order.user.phone) {
            (0, sms_1.sendInvoiceSMS)(order.user.phone, {
                customerName: order.user.name,
                invoiceNumber,
                total: order.total,
                restaurantName: invoiceData.restaurantName,
            }).then(smsSent => {
                logger_1.logger.info('Invoice SMS sent', {
                    orderId,
                    phone: order.user.phone,
                    success: smsSent,
                });
            }).catch(error => {
                logger_1.logger.error('Failed to send invoice SMS (non-critical)', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    orderId,
                    phone: order.user.phone,
                });
            });
            results.smsSent = true;
        }
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
        }
        else {
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
        logger_1.logger.info('Invoice generated and delivered', {
            orderId,
            invoiceId: invoice.id,
            deliveryResults: results,
        });
        const response = {
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
    }
    catch (error) {
        logger_1.logger.error('Invoice generation failed', {
            orderId,
            userId: req.user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new errorHandler_1.AppError('Failed to generate invoice', 500);
    }
}));
router.get('/', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const invoices = await prisma.invoice.findMany({
        where: {
            order: {
                userId: req.user.id,
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
    const response = {
        success: true,
        data: {
            invoices: invoices.map((invoice) => ({
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
router.get('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const { id } = req.params;
    if (!id) {
        throw new errorHandler_1.AppError('Invoice ID is required', 400);
    }
    const invoice = await prisma.invoice.findUnique({
        where: {
            id,
            order: {
                userId: req.user.id,
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
        throw new errorHandler_1.AppError('Invoice not found', 404);
    }
    const response = {
        success: true,
        data: { invoice },
    };
    return res.json(response);
}));
router.get('/order/:orderId', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const { orderId } = req.params;
    if (!orderId) {
        throw new errorHandler_1.AppError('Order ID is required', 400);
    }
    const invoice = await prisma.invoice.findFirst({
        where: {
            orderId,
            order: {
                userId: req.user.id,
            },
        },
    });
    if (!invoice) {
        throw new errorHandler_1.AppError('Invoice not found for this order', 404);
    }
    const response = {
        success: true,
        data: { invoice },
    };
    return res.json(response);
}));
exports.default = router;
//# sourceMappingURL=invoices.js.map