"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const razorpay_1 = require("../lib/razorpay");
const logger_1 = require("../utils/logger");
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
    const startTime = Date.now();
    logger_1.logger.info('Payment verification started', {
        razorpay_order_id,
        razorpay_payment_id,
        userId: req.user.id,
        startTime,
    });
    try {
        logger_1.logger.info('Starting signature verification', {
            razorpay_order_id,
            userId: req.user.id,
        });
        const signatureVerificationStart = Date.now();
        const isValidSignature = (0, razorpay_1.verifyRazorpaySignature)(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        const signatureVerificationTime = Date.now() - signatureVerificationStart;
        logger_1.logger.info('Signature verification completed', {
            razorpay_order_id,
            userId: req.user.id,
            duration: `${signatureVerificationTime}ms`,
            isValid: isValidSignature,
        });
        if (!isValidSignature) {
            logger_1.logger.warn('Invalid payment signature detected', {
                razorpay_order_id,
                razorpay_payment_id,
                userId: req.user.id,
                expectedSignature: 'Calculated on backend',
                receivedSignature: 'Provided by frontend',
            });
            return res.status(400).json({
                success: false,
                error: 'Invalid payment signature. Payment verification failed. Please try again or contact support if the issue persists.',
            });
        }
        logger_1.logger.info('Starting order lookup', {
            razorpay_order_id,
            userId: req.user.id,
        });
        const orderLookupStart = Date.now();
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
        const orderLookupTime = Date.now() - orderLookupStart;
        logger_1.logger.info('Order lookup completed', {
            razorpay_order_id,
            userId: req.user.id,
            duration: `${orderLookupTime}ms`,
            orderFound: !!order,
        });
        if (!order) {
            logger_1.logger.warn('Order not found during payment verification', {
                razorpay_order_id,
                userId: req.user.id,
            });
            return res.status(404).json({
                success: false,
                error: 'Order not found. The payment reference does not match any order in our system. Please contact support.',
            });
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
            logger_1.logger.info('Starting payment details fetch from Razorpay', {
                razorpay_payment_id,
                userId: req.user.id,
            });
            const paymentFetchStart = Date.now();
            const paymentDetails = await (0, razorpay_1.fetchPaymentDetails)(razorpay_payment_id);
            const paymentFetchTime = Date.now() - paymentFetchStart;
            logger_1.logger.info('Payment details fetch completed', {
                razorpay_payment_id,
                userId: req.user.id,
                duration: `${paymentFetchTime}ms`,
                status: paymentDetails.status,
            });
            if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
                logger_1.logger.warn('Payment not successful', {
                    razorpay_order_id,
                    razorpay_payment_id,
                    status: paymentDetails.status,
                    userId: req.user.id,
                });
                return res.status(400).json({
                    success: false,
                    error: `Payment not successful. Current status: ${paymentDetails.status}. Please check your payment method and try again.`,
                });
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
            logger_1.logger.info('Payment verification process completed', {
                orderId: order.id,
                userId: req.user.id,
                totalTime: `${Date.now() - startTime}ms`,
            });
            try {
                let invoice = await database_1.prisma.invoice.findUnique({
                    where: { orderId: order.id },
                });
                const invoiceNumber = invoice?.invoiceNumber ||
                    `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;
                if (!invoice) {
                    invoice = await database_1.prisma.invoice.create({
                        data: {
                            orderId: order.id,
                            invoiceNumber,
                            sentVia: [],
                            emailSent: false,
                            smsSent: false,
                        },
                    });
                }
                logger_1.logger.info('Invoice record created', {
                    orderId: order.id,
                    invoiceNumber,
                    userId: req.user.id,
                });
            }
            catch (invoiceError) {
                logger_1.logger.error('Invoice record creation failed', {
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
                orderId: order?.id,
                razorpay_order_id,
                razorpay_payment_id,
                userId: req.user.id,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            if (order?.id) {
                await database_1.prisma.order.update({
                    where: { id: order.id },
                    data: {
                        paymentStatus: 'FAILED',
                        updatedAt: new Date(),
                    },
                });
            }
            return res.status(500).json({
                success: false,
                error: 'Payment verification failed. Please try again or contact support if the issue persists.',
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Unexpected error during payment verification', {
            userId: req.user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        return res.status(500).json({
            success: false,
            error: 'An unexpected error occurred during payment verification. Please try again or contact support.',
        });
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