"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const razorpay_1 = require("../lib/razorpay");
const logger_1 = require("../utils/logger");
const pdf_1 = require("../lib/pdf");
const email_1 = require("../lib/email");
const router = (0, express_1.Router)();
const createPaymentSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(1, 'Order ID is required'),
});
const verifyPaymentSchema = zod_1.z.object({
    razorpay_order_id: zod_1.z.string().min(1, 'Razorpay order ID is required'),
    razorpay_payment_id: zod_1.z.string().min(1, 'Razorpay payment ID is required'),
    razorpay_signature: zod_1.z.string().min(1, 'Razorpay signature is required'),
});
const refundPaymentSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(1, 'Order ID is required'),
    amount: zod_1.z.number().positive().optional(),
    reason: zod_1.z.string().optional(),
});
router.post('/create', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId } = createPaymentSchema.parse(req.body);
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
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
        throw new errorHandler_1.AppError('Order not found or already processed', 404);
    }
    try {
        const razorpayOrder = await (0, razorpay_1.createRazorpayOrder)({
            amount: order.total,
            receipt: `order_${order.id}`,
            notes: {
                orderId: order.id,
                userId: req.user.id,
                tableId: order.tableId,
                customerName: order.user.name,
                tableNumber: String(order.table.number),
            },
        });
        await database_1.prisma.order.update({
            where: { id: orderId },
            data: {
                paymentId: razorpayOrder.id,
                paymentStatus: 'PROCESSING',
            },
        });
        logger_1.logger.info('Payment order created', {
            orderId,
            razorpayOrderId: razorpayOrder.id,
            amount: order.total,
            userId: req.user.id,
        });
        const response = {
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
    }
    catch (error) {
        logger_1.logger.error('Payment order creation failed', {
            orderId,
            userId: req.user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new errorHandler_1.AppError('Failed to create payment order', 500);
    }
}));
router.post('/verify', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verifyPaymentSchema.parse(req.body);
    const isValidSignature = (0, razorpay_1.verifyRazorpaySignature)(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValidSignature) {
        logger_1.logger.warn('Invalid payment signature detected', {
            razorpay_order_id,
            razorpay_payment_id,
            userId: req.user.id,
        });
        throw new errorHandler_1.AppError('Invalid payment signature. Payment verification failed.', 400);
    }
    const order = await database_1.prisma.order.findFirst({
        where: {
            paymentId: razorpay_order_id,
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
    if (order.paymentStatus === 'COMPLETED') {
        const response = {
            success: true,
            message: 'Payment already verified',
            data: { order },
        };
        return res.json(response);
    }
    try {
        const paymentDetails = await (0, razorpay_1.fetchPaymentDetails)(razorpay_payment_id);
        if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
            throw new errorHandler_1.AppError('Payment not successful', 400);
        }
        const updatedOrder = await database_1.prisma.order.update({
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
        logger_1.logger.info('Payment verified successfully', {
            orderId: order.id,
            razorpay_order_id,
            razorpay_payment_id,
            userId: req.user.id,
            amount: order.total,
        });
        try {
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
            const pdfFileName = `invoice-${invoiceNumber}.pdf`;
            const pdfPath = await (0, pdf_1.savePDFToStorage)(pdfBuffer, pdfFileName);
            const results = {
                emailSent: false,
                smsSent: false,
                pdfGenerated: true,
                pdfPath,
            };
            if (order.user.email) {
                results.emailSent = await (0, email_1.sendInvoiceEmail)(order.user.email, {
                    customerName: order.user.name,
                    invoiceNumber,
                    orderDate: invoiceData.orderDate,
                    total: order.total,
                    tableNumber: order.table.number,
                    restaurantName: invoiceData.restaurantName,
                }, pdfBuffer);
            }
            if (!invoice) {
                invoice = await database_1.prisma.invoice.create({
                    data: {
                        orderId: order.id,
                        invoiceNumber,
                        sentVia: ['EMAIL'],
                        emailSent: results.emailSent,
                        smsSent: results.smsSent,
                        pdfPath: results.pdfPath,
                    },
                });
            }
            else {
                const updatedSentVia = [...invoice.sentVia];
                if (!updatedSentVia.includes('EMAIL')) {
                    updatedSentVia.push('EMAIL');
                }
                invoice = await database_1.prisma.invoice.update({
                    where: { id: invoice.id },
                    data: {
                        sentVia: updatedSentVia,
                        emailSent: invoice.emailSent || results.emailSent,
                        smsSent: invoice.smsSent || results.smsSent,
                        pdfPath: results.pdfPath,
                    },
                });
            }
            logger_1.logger.info('Invoice automatically generated and sent', {
                orderId: order.id,
                invoiceNumber,
                userId: req.user.id,
                results,
            });
        }
        catch (invoiceError) {
            logger_1.logger.error('Automatic invoice generation failed', {
                orderId: order.id,
                userId: req.user.id,
                error: invoiceError instanceof Error ? invoiceError.message : 'Unknown error',
            });
        }
        const response = {
            success: true,
            message: 'Payment verified successfully',
            data: {
                order: updatedOrder,
                paymentId: razorpay_payment_id,
            },
        };
        return res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Payment verification failed', {
            orderId: order.id,
            razorpay_order_id,
            razorpay_payment_id,
            userId: req.user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        await database_1.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: 'FAILED',
                updatedAt: new Date(),
            },
        });
        throw new errorHandler_1.AppError('Payment verification failed', 500);
    }
}));
router.post('/refund', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId, amount, reason } = refundPaymentSchema.parse(req.body);
    if (!orderId) {
        throw new errorHandler_1.AppError('Order ID is required', 400);
    }
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
            paymentStatus: 'COMPLETED',
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found or payment not completed', 404);
    }
    if (!order.paymentId) {
        throw new errorHandler_1.AppError('No payment ID found for this order', 400);
    }
    try {
        const paymentDetails = await (0, razorpay_1.fetchPaymentDetails)(order.paymentId);
        const refund = await (0, razorpay_1.refundRazorpayPayment)(paymentDetails.id, amount || order.total, reason || 'Customer requested refund');
        await database_1.prisma.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: 'REFUNDED',
                status: 'CANCELLED',
                updatedAt: new Date(),
            },
        });
        logger_1.logger.info('Payment refunded successfully', {
            orderId,
            refundId: refund.id,
            amount: refund.amount,
            userId: req.user.id,
        });
        const response = {
            success: true,
            message: 'Payment refunded successfully',
            data: {
                refundId: refund.id,
                amount: refund.amount ? refund.amount / 100 : 0,
                status: refund.status,
            },
        };
        return res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Payment refund failed', {
            orderId,
            userId: req.user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new errorHandler_1.AppError('Failed to process refund', 500);
    }
}));
router.get('/status/:orderId', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId } = req.params;
    if (!orderId) {
        throw new errorHandler_1.AppError('Order ID is required', 400);
    }
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
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
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    const response = {
        success: true,
        data: { order },
    };
    res.json(response);
}));
exports.default = router;
//# sourceMappingURL=payments.js.map