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
    const prisma = (0, database_1.getPrismaClient)();
    const { orderId } = createPaymentSchema.parse(req.body);
    const order = await prisma.order.findFirst({
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
        await prisma.order.update({
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
    const prisma = (0, database_1.getPrismaClient)();
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
    const order = await prisma.order.findFirst({
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
        const invoiceData = {
            customerName: updatedOrder.user.name,
            customerEmail: updatedOrder.user.email,
            customerPhone: updatedOrder.user.phone || '',
            invoiceNumber: `INV-${Date.now()}-${updatedOrder.id.substring(0, 8).toUpperCase()}`,
            orderDate: updatedOrder.createdAt.toLocaleDateString('en-IN'),
            items: updatedOrder.items.map((item) => ({
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
        const invoicePDF = await (0, pdf_1.generateInvoicePDF)(invoiceData);
        const invoiceUrl = await (0, pdf_1.savePDFToStorage)(invoicePDF, `invoice_${updatedOrder.id}.pdf`);
        (0, email_1.sendInvoiceEmail)(updatedOrder.user.email, {
            customerName: updatedOrder.user.name,
            invoiceNumber: invoiceData.invoiceNumber,
            orderDate: invoiceData.orderDate,
            total: updatedOrder.total,
            tableNumber: updatedOrder.table.number,
            restaurantName: invoiceData.restaurantName,
        }, invoicePDF).catch(error => {
            logger_1.logger.error('Failed to send invoice email (non-critical)', {
                error: error instanceof Error ? error.message : 'Unknown error',
                orderId: updatedOrder.id,
                email: updatedOrder.user.email,
            });
        });
        logger_1.logger.info('Payment verified successfully', {
            orderId: order.id,
            razorpayPaymentId: razorpay_payment_id,
            userId: req.user.id,
        });
        const response = {
            success: true,
            message: 'Payment verified successfully',
            data: {
                order: updatedOrder,
                invoiceUrl,
            },
        };
        return res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Payment verification failed', {
            orderId: order.id,
            razorpayPaymentId: razorpay_payment_id,
            userId: req.user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        await prisma.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'FAILED' },
        });
        throw new errorHandler_1.AppError('Payment verification failed', 500);
    }
}));
router.get('/status/:orderId', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const { orderId } = req.params;
    if (!orderId) {
        throw new errorHandler_1.AppError('Order ID is required', 400);
    }
    const order = await prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
        },
        select: {
            id: true,
            paymentStatus: true,
            total: true,
            createdAt: true,
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    const response = {
        success: true,
        data: { order },
    };
    return res.json(response);
}));
router.post('/refund', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const prisma = (0, database_1.getPrismaClient)();
    const { orderId, amount, reason } = refundPaymentSchema.parse(req.body);
    const order = await prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
            paymentStatus: 'COMPLETED',
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Completed order not found', 404);
    }
    if (!order.paymentId) {
        throw new errorHandler_1.AppError('Payment ID not found for this order', 400);
    }
    try {
        const refund = await (0, razorpay_1.refundRazorpayPayment)(order.paymentId, amount || order.total, reason || 'Customer requested refund');
        await prisma.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: 'REFUNDED',
            },
        });
        logger_1.logger.info('Payment refunded successfully', {
            orderId,
            amount: refund.amount,
            userId: req.user.id,
        });
        const response = {
            success: true,
            message: 'Payment refunded successfully',
            data: { refund },
        };
        return res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Payment refund failed', {
            orderId,
            paymentId: order.paymentId,
            userId: req.user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new errorHandler_1.AppError('Failed to process refund', 500);
    }
}));
exports.default = router;
//# sourceMappingURL=payments.js.map