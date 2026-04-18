"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const restaurant_1 = require("../middleware/restaurant");
const errorHandler_1 = require("../middleware/errorHandler");
const pdf_1 = require("../lib/pdf");
const email_1 = require("../lib/email");
const sms_1 = require("../lib/sms");
const logger_1 = require("../utils/logger");
const accelerate_cache_1 = require("../utils/accelerate-cache");
const realtime_1 = require("../utils/realtime");
const order_contact_service_1 = require("../services/order-contact.service");
const router = (0, express_1.Router)();
const resolveInvoiceDeliveryContact = (order) => {
    const placementContact = (0, order_contact_service_1.resolveOrderPlacementContact)(order);
    return {
        name: placementContact.name || order?.user?.name || 'Guest',
        email: placementContact.email || '',
        phone: placementContact.phone || order?.deliveryCustomerPhone || order?.user?.phone || '',
    };
};
const getInvoiceSmsPhone = (order) => {
    const contact = resolveInvoiceDeliveryContact(order);
    return contact.phone || null;
};
const emitInvoiceReady = (input) => {
    (0, realtime_1.emitRestaurantEvent)(input.restaurantId, {
        type: 'invoice.ready',
        userId: input.userId,
        payload: {
            orderId: input.orderId,
            invoiceId: input.invoiceId,
            invoiceNumber: input.invoiceNumber,
            invoiceUrl: input.invoiceUrl,
            delivery: {
                emailSent: input.emailSent,
                smsSent: input.smsSent,
            },
        },
    });
};
const generateInvoiceSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(1, 'Order ID is required'),
    methods: zod_1.z.array(zod_1.z.enum(['EMAIL', 'SMS'])).default([]),
});
const testOrderCompletionSmsSchema = zod_1.z.object({
    phone: zod_1.z.string().min(8, 'Phone is required'),
    data: zod_1.z.object({
        customerName: zod_1.z.string().min(1, 'Customer name is required'),
        restaurantName: zod_1.z.string().min(1, 'Restaurant name is required'),
        invoiceNumber: zod_1.z.string().min(1, 'Invoice number is required'),
        total: zod_1.z.number().nonnegative('Total must be zero or greater'),
        invoiceUrl: zod_1.z.string().url('Invoice URL must be a valid URL'),
    }),
});
router.post('/test-sms', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        throw new errorHandler_1.AppError('Not found', 404);
    }
    const { phone, data } = testOrderCompletionSmsSchema.parse(req.body);
    const smsSent = await (0, sms_1.sendOrderCompletionSMS)(phone, data);
    return res.status(200).json({
        success: true,
        message: smsSent ? 'Test SMS sent successfully' : 'Test SMS failed to send',
        data: {
            smsSent,
            phone,
            provider: process.env['SMS_PROVIDER'] || 'fast2sms',
        },
    });
}));
router.post('/generate', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId, methods } = generateInvoiceSchema.parse(req.body);
    const requestedMethods = methods || [];
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
            restaurantId: req.restaurant.id,
            paymentStatus: 'COMPLETED',
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
        throw new errorHandler_1.AppError('Order not found or payment not completed', 404);
    }
    try {
        let invoice = await database_1.prisma.invoice.findUnique({
            where: { orderId },
        });
        const alreadyDeliveredForRequestedMethods = invoice
            ? requestedMethods.length === 0 || requestedMethods.every((method) => {
                if (method === 'EMAIL')
                    return invoice.emailSent;
                if (method === 'SMS')
                    return invoice.smsSent;
                return false;
            })
            : false;
        if (invoice && alreadyDeliveredForRequestedMethods) {
            logger_1.logger.info('Invoice already exists and requested delivery methods are already sent', {
                orderId,
                invoiceId: invoice.id,
                requestedMethods,
                sentVia: invoice.sentVia,
            });
            const response = {
                success: true,
                message: 'Invoice already generated',
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
            emitInvoiceReady({
                restaurantId: req.restaurant.id,
                orderId,
                userId: req.user.id,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                invoiceUrl: invoice.pdfPath || null,
                emailSent: invoice.emailSent,
                smsSent: invoice.smsSent,
            });
            return res.status(200).json(response);
        }
        const invoiceNumber = invoice?.invoiceNumber ||
            `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;
        const taxPercent = order.subtotalPaise > 0
            ? Math.round((order.taxPaise / order.subtotalPaise) * 100)
            : undefined;
        const deliveryContact = resolveInvoiceDeliveryContact(order);
        const invoiceData = {
            restaurantName: order.restaurant.name,
            ...(order.restaurant.address ? { restaurantAddress: order.restaurant.address } : {}),
            ...(order.restaurant.city ? { restaurantCity: order.restaurant.city } : {}),
            ...(order.restaurant.state ? { restaurantState: order.restaurant.state } : {}),
            ...(order.restaurant.phone ? { restaurantPhone: order.restaurant.phone } : {}),
            ...(order.restaurant.email ? { restaurantEmail: order.restaurant.email } : {}),
            ...(order.restaurant.gstNumber ? { gstNumber: order.restaurant.gstNumber } : {}),
            ...(taxPercent !== undefined ? { taxPercent } : {}),
            customerName: deliveryContact.name,
            customerEmail: deliveryContact.email,
            ...(deliveryContact.phone ? { customerPhone: deliveryContact.phone } : {}),
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
            paymentMethod: `${order.paymentProvider || 'RAZORPAY'}`,
        };
        const smsPhone = getInvoiceSmsPhone(order);
        const pdfBuffer = (0, pdf_1.generateInvoicePDF)(invoiceData);
        const pdfFileName = `invoice-${invoiceNumber}.pdf`;
        const pdfStorageResult = await (0, pdf_1.savePDFToStorage)(pdfBuffer, pdfFileName);
        const results = {
            emailSent: false,
            smsSent: false,
            pdfGenerated: true,
            pdfPath: pdfStorageResult.pdfPath,
        };
        if (requestedMethods.includes('EMAIL') && deliveryContact.email) {
            results.emailSent = await (0, email_1.sendInvoiceEmail)(deliveryContact.email, {
                customerName: deliveryContact.name,
                invoiceNumber,
                orderDate: invoiceData.orderDate,
                total: order.totalPaise / 100,
                tableNumber: order.table.number,
                restaurantName: invoiceData.restaurantName,
            }, pdfBuffer);
        }
        if (requestedMethods.includes('SMS') && smsPhone) {
            results.smsSent = await (0, sms_1.sendOrderCompletionSMS)(smsPhone, {
                customerName: deliveryContact.name,
                invoiceNumber,
                total: order.totalPaise / 100,
                restaurantName: invoiceData.restaurantName,
                invoiceUrl: invoice.pdfPath || null,
            });
        }
        const successfulMethods = [
            ...(results.emailSent ? ['EMAIL'] : []),
            ...(results.smsSent ? ['SMS'] : []),
        ];
        if (!invoice) {
            invoice = await database_1.prisma.invoice.create({
                data: {
                    orderId,
                    invoiceNumber,
                    sentVia: successfulMethods,
                    emailSent: results.emailSent,
                    smsSent: results.smsSent,
                    pdfPath: pdfStorageResult.pdfPath,
                    pdfData: pdfStorageResult.pdfData,
                    pdfName: pdfStorageResult.pdfName,
                },
            });
        }
        else {
            const updatedSentVia = [...new Set([...invoice.sentVia, ...successfulMethods])];
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
            methods: requestedMethods,
            results,
        });
        emitInvoiceReady({
            restaurantId: req.restaurant.id,
            orderId,
            userId: req.user.id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceUrl: invoice.pdfPath || null,
            emailSent: invoice.emailSent,
            smsSent: invoice.smsSent,
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
                warnings: generateWarnings(requestedMethods, deliveryContact.email, smsPhone, results),
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
        ...(0, accelerate_cache_1.accelerateCache)(120, 300),
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
    const take = typeof req.query['take'] !== 'undefined' ? Math.min(Number(req.query['take']) || 0, 100) : undefined;
    const cursor = req.query['cursor'] ? { id: String(req.query['cursor']) } : undefined;
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
        ...(0, accelerate_cache_1.accelerateCache)(120, 300),
        ...(typeof take === 'number' ? { take } : {}),
        ...(cursor ? { cursor, skip: 1 } : {}),
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
    const requestedMethods = methods || [];
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
        throw new errorHandler_1.AppError('Invoice not found', 404);
    }
    try {
        const results = {
            emailSent: false,
            smsSent: false,
        };
        const resendRestaurantName = invoice.order.restaurant?.name ?? 'Restaurant';
        const deliveryContact = resolveInvoiceDeliveryContact(invoice.order);
        const invoiceData = {
            customerName: deliveryContact.name,
            invoiceNumber: invoice.invoiceNumber,
            orderDate: invoice.order.createdAt.toLocaleDateString('en-IN'),
            total: invoice.order.totalPaise / 100,
            tableNumber: invoice.order.table.number,
            restaurantName: resendRestaurantName,
        };
        const smsPhone = getInvoiceSmsPhone(invoice.order);
        if (requestedMethods.includes('EMAIL') && deliveryContact.email) {
            const resendTaxPercent = invoice.order.subtotalPaise > 0
                ? Math.round((invoice.order.taxPaise / invoice.order.subtotalPaise) * 100)
                : undefined;
            const pdfBuffer = (0, pdf_1.generateInvoicePDF)({
                ...(invoice.order.restaurant?.address ? { restaurantAddress: invoice.order.restaurant.address } : {}),
                ...(invoice.order.restaurant?.city ? { restaurantCity: invoice.order.restaurant.city } : {}),
                ...(invoice.order.restaurant?.state ? { restaurantState: invoice.order.restaurant.state } : {}),
                ...(invoice.order.restaurant?.phone ? { restaurantPhone: invoice.order.restaurant.phone } : {}),
                ...(invoice.order.restaurant?.gstNumber ? { gstNumber: invoice.order.restaurant.gstNumber } : {}),
                ...(resendTaxPercent !== undefined ? { taxPercent: resendTaxPercent } : {}),
                ...invoiceData,
                items: [],
                subtotal: invoice.order.subtotalPaise / 100,
                tax: invoice.order.taxPaise / 100,
                customerEmail: deliveryContact.email,
                ...(smsPhone ? { customerPhone: smsPhone } : {}),
            });
            results.emailSent = await (0, email_1.sendInvoiceEmail)(deliveryContact.email, invoiceData, pdfBuffer);
        }
        if (requestedMethods.includes('SMS') && smsPhone) {
            results.smsSent = await (0, sms_1.sendOrderCompletionSMS)(smsPhone, {
                ...invoiceData,
                invoiceUrl: invoice.pdfPath || null,
            });
        }
        const successfulMethods = [
            ...(results.emailSent ? ['EMAIL'] : []),
            ...(results.smsSent ? ['SMS'] : []),
        ];
        const updatedSentVia = [...new Set([...invoice.sentVia, ...successfulMethods])];
        const updatedInvoice = await database_1.prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                sentVia: updatedSentVia,
                emailSent: invoice.emailSent || results.emailSent,
                smsSent: invoice.smsSent || results.smsSent,
            },
        });
        emitInvoiceReady({
            restaurantId: req.restaurant.id,
            orderId: invoice.orderId,
            userId: req.user.id,
            invoiceId: updatedInvoice.id,
            invoiceNumber: updatedInvoice.invoiceNumber,
            invoiceUrl: updatedInvoice.pdfPath || null,
            emailSent: updatedInvoice.emailSent,
            smsSent: updatedInvoice.smsSent,
        });
        logger_1.logger.info('Invoice resent successfully', {
            invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            userId: req.user.id,
            methods: requestedMethods,
            results,
        });
        const response = {
            success: true,
            message: 'Invoice resent successfully',
            data: {
                deliveryResults: results,
                warnings: generateWarnings(requestedMethods, deliveryContact.email, smsPhone, results),
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
                restaurant: {
                    select: {
                        name: true, address: true, city: true,
                        state: true, phone: true, email: true, gstNumber: true,
                    },
                },
            },
        });
        if (!order) {
            throw new errorHandler_1.AppError('Invoice not found', 404);
        }
        const invoiceNumber = `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;
        invoice = await database_1.prisma.invoice.create({
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
    if (!order)
        throw new errorHandler_1.AppError('Order not found for invoice', 404);
    const rfTaxPercent = order.subtotalPaise > 0
        ? Math.round((order.taxPaise / order.subtotalPaise) * 100)
        : undefined;
    const deliveryContact = resolveInvoiceDeliveryContact(order);
    const invoiceData = {
        restaurantName: order.restaurant?.name ?? 'Restaurant',
        ...(order.restaurant?.address ? { restaurantAddress: order.restaurant.address } : {}),
        ...(order.restaurant?.city ? { restaurantCity: order.restaurant.city } : {}),
        ...(order.restaurant?.state ? { restaurantState: order.restaurant.state } : {}),
        ...(order.restaurant?.phone ? { restaurantPhone: order.restaurant.phone } : {}),
        ...(order.restaurant?.email ? { restaurantEmail: order.restaurant.email } : {}),
        ...(order.restaurant?.gstNumber ? { gstNumber: order.restaurant.gstNumber } : {}),
        ...(rfTaxPercent !== undefined ? { taxPercent: rfTaxPercent } : {}),
        customerName: deliveryContact.name,
        customerEmail: deliveryContact.email,
        ...(deliveryContact.phone ? { customerPhone: deliveryContact.phone } : {}),
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
        paymentMethod: `${order.paymentProvider || 'RAZORPAY'}`,
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