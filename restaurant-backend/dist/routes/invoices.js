"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("@/config/database");
const auth_1 = require("@/middleware/auth");
const restaurant_1 = require("@/middleware/restaurant");
const errorHandler_1 = require("@/middleware/errorHandler");
const pdf_1 = require("@/lib/pdf");
const email_1 = require("@/lib/email");
const sms_1 = require("@/lib/sms");
const logger_1 = require("@/utils/logger");
const router = (0, express_1.Router)();
const generateInvoiceSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(1, 'Order ID is required'),
    methods: zod_1.z.array(zod_1.z.enum(['EMAIL', 'SMS'])).default([]),
});
router.post('/generate', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId, methods } = generateInvoiceSchema.parse(req.body);
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
            restaurantId: req.restaurant.id,
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
                            pricePaise: true,
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
        let invoice = await database_1.prisma.invoice.findUnique({
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
                price: item.pricePaise / 100,
                total: (item.pricePaise * item.quantity) / 100,
            })),
            subtotal: order.subtotalPaise / 100,
            tax: order.taxPaise / 100,
            total: order.totalPaise / 100,
            tableNumber: order.table.number,
            restaurantName: process.env.APP_NAME || 'Restaurant',
            restaurantAddress: 'Your Restaurant Address Here',
            restaurantPhone: process.env.TWILIO_PHONE_NUMBER,
            paymentMethod: `Online Payment (${order.paymentProvider || 'RAZORPAY'})`,
        };
        const pdfBuffer = (0, pdf_1.generateInvoicePDF)(invoiceData);
        const pdfFileName = `invoice-${invoiceNumber}.pdf`;
        const pdfStorageResult = await (0, pdf_1.savePDFToStorage)(pdfBuffer, pdfFileName);
        const results = {
            emailSent: false,
            smsSent: false,
            pdfGenerated: true,
            pdfPath: pdfStorageResult.pdfPath,
        };
        const deliveryMethods = methods || [];
        if (deliveryMethods.includes('EMAIL') && order.user.email) {
            results.emailSent = await (0, email_1.sendInvoiceEmail)(order.user.email, {
                customerName: order.user.name,
                invoiceNumber,
                orderDate: invoiceData.orderDate,
                total: order.totalPaise / 100,
                tableNumber: order.table.number,
                restaurantName: invoiceData.restaurantName,
            }, pdfBuffer);
        }
        if (deliveryMethods.includes('SMS') && order.user.phone) {
            results.smsSent = await (0, sms_1.sendInvoiceSMS)(order.user.phone, {
                customerName: order.user.name,
                invoiceNumber,
                total: order.totalPaise / 100,
                restaurantName: invoiceData.restaurantName,
            });
        }
        if (!invoice) {
            invoice = await database_1.prisma.invoice.create({
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
        }
        else {
            const updatedSentVia = [...new Set([...invoice.sentVia, ...deliveryMethods])];
            invoice = await database_1.prisma.invoice.update({
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
        logger_1.logger.info('Invoice generated and delivered', {
            orderId,
            invoiceNumber,
            userId: req.user.id,
            methods,
            results,
        });
        const response = {
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
router.get('/:orderId', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId } = req.params;
    if (!orderId) {
        throw new errorHandler_1.AppError('Order ID is required', 400);
    }
    const invoice = await database_1.prisma.invoice.findFirst({
        where: {
            orderId,
            order: {
                userId: req.user.id,
                restaurantId: req.restaurant.id,
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
router.get('/user/list', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const invoices = await database_1.prisma.invoice.findMany({
        where: {
            order: {
                userId: req.user.id,
                restaurantId: req.restaurant.id,
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
    });
    const response = {
        success: true,
        data: { invoices },
    };
    res.json(response);
}));
router.post('/:invoiceId/resend', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { invoiceId } = req.params;
    const { methods } = zod_1.z.object({
        methods: zod_1.z.array(zod_1.z.enum(['EMAIL', 'SMS'])).default([]),
    }).parse(req.body);
    if (!invoiceId) {
        throw new errorHandler_1.AppError('Invoice ID is required', 400);
    }
    const invoice = await database_1.prisma.invoice.findFirst({
        where: {
            id: invoiceId,
            order: {
                userId: req.user.id,
                restaurantId: req.restaurant.id,
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
        throw new errorHandler_1.AppError('Invoice not found', 404);
    }
    try {
        const results = {
            emailSent: false,
            smsSent: false,
        };
        const invoiceData = {
            customerName: invoice.order.user.name,
            invoiceNumber: invoice.invoiceNumber,
            orderDate: invoice.order.createdAt.toLocaleDateString('en-IN'),
            total: invoice.order.totalPaise / 100,
            tableNumber: invoice.order.table.number,
            restaurantName: process.env.APP_NAME || 'Restaurant',
        };
        const deliveryMethods = methods || [];
        if (deliveryMethods.includes('EMAIL') && invoice.order.user.email) {
            const pdfBuffer = (0, pdf_1.generateInvoicePDF)({
                ...invoiceData,
                items: [],
                subtotal: invoice.order.subtotalPaise / 100,
                tax: invoice.order.taxPaise / 100,
                customerEmail: invoice.order.user.email,
                customerPhone: invoice.order.user.phone || '',
            });
            results.emailSent = await (0, email_1.sendInvoiceEmail)(invoice.order.user.email, invoiceData, pdfBuffer);
        }
        if (deliveryMethods.includes('SMS') && invoice.order.user.phone) {
            results.smsSent = await (0, sms_1.sendInvoiceSMS)(invoice.order.user.phone, invoiceData);
        }
        const updatedSentVia = [...new Set([...invoice.sentVia, ...deliveryMethods])];
        await database_1.prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                sentVia: updatedSentVia,
                emailSent: invoice.emailSent || results.emailSent,
                smsSent: invoice.smsSent || results.smsSent,
            },
        });
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
                warnings: generateWarnings(deliveryMethods, invoice.order.user.email, invoice.order.user.phone, results),
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
router.post('/:invoiceOrOrderId/refresh-pdf', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { invoiceOrOrderId } = req.params;
    if (!invoiceOrOrderId) {
        throw new errorHandler_1.AppError('Invoice or Order ID is required', 400);
    }
    let invoice = await database_1.prisma.invoice.findFirst({
        where: {
            OR: [
                { id: invoiceOrOrderId },
                { orderId: invoiceOrOrderId },
            ],
            order: { userId: req.user.id, restaurantId: req.restaurant.id },
        },
        include: {
            order: {
                include: {
                    items: { include: { menuItem: { select: { name: true, pricePaise: true } } } },
                    table: true,
                    user: true,
                },
            },
        },
    });
    if (!invoice) {
        const order = await database_1.prisma.order.findFirst({
            where: {
                id: invoiceOrOrderId,
                userId: req.user.id,
                restaurantId: req.restaurant.id,
                paymentStatus: 'COMPLETED',
            },
            include: {
                items: { include: { menuItem: { select: { name: true, pricePaise: true } } } },
                table: true,
                user: true,
            },
        });
        if (!order) {
            throw new errorHandler_1.AppError('Invoice not found', 404);
        }
        const invoiceNumber = `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;
        invoice = await database_1.prisma.invoice.create({
            data: { orderId: order.id, invoiceNumber },
            include: { order: { include: { items: { include: { menuItem: { select: { name: true, pricePaise: true } } } }, table: true, user: true } } },
        });
    }
    const order = invoice.order;
    if (!order)
        throw new errorHandler_1.AppError('Order not found for invoice', 404);
    const invoiceData = {
        customerName: order.user?.name || '',
        customerEmail: order.user?.email || '',
        customerPhone: order.user?.phone || '',
        invoiceNumber: invoice.invoiceNumber,
        orderDate: order.createdAt.toLocaleDateString('en-IN'),
        items: (order.items || []).map((it) => ({
            name: it.menuItem?.name || 'Item',
            quantity: it.quantity,
            price: it.pricePaise / 100,
            total: (it.pricePaise * it.quantity) / 100,
        })),
        subtotal: order.subtotalPaise / 100,
        tax: order.taxPaise / 100,
        total: order.totalPaise / 100,
        tableNumber: order.table?.number || 0,
        restaurantName: process.env.APP_NAME || 'Restaurant',
        restaurantAddress: 'Your Restaurant Address Here',
        restaurantPhone: process.env.TWILIO_PHONE_NUMBER,
        paymentMethod: `Online Payment (${order.paymentProvider || 'RAZORPAY'})`,
    };
    const pdfBuffer = (0, pdf_1.generateInvoicePDF)(invoiceData);
    const pdfFileName = `invoice-${invoice.invoiceNumber}.pdf`;
    const pdfStorageResult = await (0, pdf_1.savePDFToStorage)(pdfBuffer, pdfFileName);
    const updated = await database_1.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
            pdfPath: pdfStorageResult.pdfPath,
            pdfData: pdfStorageResult.pdfData,
            pdfName: pdfStorageResult.pdfName,
        },
    });
    const response = {
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
function generateWarnings(methods, email, phone, results) {
    const warnings = [];
    if (methods.includes('EMAIL')) {
        if (!email) {
            warnings.push('Email delivery skipped: No email address available');
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