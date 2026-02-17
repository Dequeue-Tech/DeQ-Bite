"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const payments_1 = require("../lib/payments");
const logger_1 = require("../utils/logger");
const pdf_1 = require("../lib/pdf");
const restaurant_1 = require("../middleware/restaurant");
const router = (0, express_1.Router)();
router.get('/providers', restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const providers = [
        ...(0, payments_1.getEnabledProviders)(),
        ...(req.restaurant?.cashPaymentEnabled ? ['CASH'] : []),
    ];
    const response = {
        success: true,
        data: { providers },
    };
    return res.json(response);
}));
const createPaymentSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(1, 'Order ID is required'),
    paymentProvider: zod_1.z.enum(['RAZORPAY', 'PAYTM', 'PHONEPE']).optional(),
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
router.post('/create', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId, paymentProvider } = createPaymentSchema.parse(req.body);
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
            restaurantId: req.restaurant.id,
            paymentStatus: {
                in: ['PENDING', 'FAILED', 'PROCESSING'],
            },
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
    if (order.paymentProvider === 'CASH') {
        throw new errorHandler_1.AppError('This order uses cash payment. Ask manager/admin to confirm payment.', 400);
    }
    try {
        const providerToUse = (paymentProvider || order.paymentProvider || 'RAZORPAY');
        const provider = (0, payments_1.getPaymentProvider)(providerToUse);
        if (!provider.isEnabled()) {
            throw new errorHandler_1.AppError(`${providerToUse} is not enabled`, 400);
        }
        const paymentOrder = await provider.createOrder({
            amountPaise: order.totalPaise,
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
                paymentId: paymentOrder.paymentOrderId,
                paymentProvider: providerToUse,
                paymentStatus: 'PROCESSING',
            },
        });
        logger_1.logger.info('Payment order created', {
            orderId,
            paymentOrderId: paymentOrder.paymentOrderId,
            amountPaise: order.totalPaise,
            userId: req.user.id,
        });
        const response = {
            success: true,
            message: 'Payment order created successfully',
            data: {
                paymentOrderId: paymentOrder.paymentOrderId,
                amountPaise: paymentOrder.amountPaise,
                currency: paymentOrder.currency,
                provider: paymentOrder.provider,
                publicKey: paymentOrder.publicKey,
                redirectUrl: paymentOrder.redirectUrl,
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
router.post('/verify', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verifyPaymentSchema.parse(req.body);
    const startTime = Date.now();
    logger_1.logger.info('Payment verification started', {
        razorpay_order_id,
        razorpay_payment_id,
        userId: req.user.id,
        startTime,
    });
    try {
        console.log('Verifying payment...');
        logger_1.logger.info('Starting order lookup', {
            razorpay_order_id,
            userId: req.user.id,
        });
        const orderLookupStart = Date.now();
        const order = await database_1.prisma.order.findFirst({
            where: {
                paymentId: razorpay_order_id,
                userId: req.user.id,
                restaurantId: req.restaurant.id,
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
        console.log('Order found:', order);
        if (order.paymentStatus === 'COMPLETED') {
            const response = {
                success: true,
                message: 'Payment already verified',
                data: { order },
            };
            return res.json(response);
        }
        try {
            const provider = (0, payments_1.getPaymentProvider)(order.paymentProvider);
            await provider.verifyPayment({
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
            });
            const updatedOrder = await database_1.prisma.order.update({
                where: { id: order.id },
                data: {
                    paymentStatus: 'COMPLETED',
                    status: 'CONFIRMED',
                    paymentTransactionId: razorpay_payment_id,
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
                                    pricePaise: true,
                                },
                            },
                        },
                    },
                },
            });
            console.log('Payment verified successfully');
            logger_1.logger.info('Payment verified successfully', {
                orderId: order.id,
                razorpay_order_id,
                razorpay_payment_id,
                userId: req.user.id,
                amountPaise: order.totalPaise,
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
                const pdfBuffer = await (0, pdf_1.generateInvoicePDF)(invoiceData);
                const pdfFileName = `invoice-${invoiceNumber}.pdf`;
                const pdfStorageResult = await (0, pdf_1.savePDFToStorage)(pdfBuffer, pdfFileName);
                const pdfPath = pdfStorageResult.pdfPath ?? pdfStorageResult.pdfName ?? null;
                const results = {
                    emailSent: false,
                    smsSent: false,
                    pdfGenerated: true,
                    pdfPath,
                };
                console.log('Invoice generated successfully');
                console.log('Delivery results:', results);
                console.log('Invoice sent successfully');
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
router.post('/refund', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId, amount, reason } = refundPaymentSchema.parse(req.body);
    if (!orderId) {
        throw new errorHandler_1.AppError('Order ID is required', 400);
    }
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
            restaurantId: req.restaurant.id,
            paymentStatus: 'COMPLETED',
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found or payment not completed', 404);
    }
    if (!order.paymentId) {
        throw new errorHandler_1.AppError('No payment ID found for this order', 400);
    }
    if (!order.paymentTransactionId) {
        throw new errorHandler_1.AppError('No payment transaction ID found for this order', 400);
    }
    try {
        const provider = (0, payments_1.getPaymentProvider)(order.paymentProvider);
        const refund = await provider.refund(order.paymentTransactionId, amount ? Math.round(amount * 100) : order.totalPaise, reason || 'Customer requested refund');
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
router.get('/status/:orderId', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId } = req.params;
    if (!orderId) {
        throw new errorHandler_1.AppError('Order ID is required', 400);
    }
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
            restaurantId: req.restaurant.id,
        },
        select: {
            id: true,
            status: true,
            paymentStatus: true,
            paymentId: true,
            totalPaise: true,
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
router.post('/cash/confirm', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const payload = zod_1.z.object({
        orderId: zod_1.z.string().min(1, 'Order ID is required'),
    }).parse(req.body);
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: payload.orderId,
            restaurantId: req.restaurant.id,
            paymentProvider: 'CASH',
            paymentStatus: {
                in: ['PENDING', 'PROCESSING', 'FAILED'],
            },
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
        throw new errorHandler_1.AppError('Cash order not found or already confirmed', 404);
    }
    const updatedOrder = await database_1.prisma.order.update({
        where: { id: order.id },
        data: {
            paymentStatus: 'COMPLETED',
            status: order.status === 'PENDING' ? 'CONFIRMED' : order.status,
            paymentTransactionId: `cash-${Date.now()}`,
            updatedAt: new Date(),
        },
    });
    const existingInvoice = await database_1.prisma.invoice.findUnique({
        where: { orderId: order.id },
    });
    if (!existingInvoice) {
        const invoiceNumber = `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;
        await database_1.prisma.invoice.create({
            data: {
                orderId: order.id,
                invoiceNumber,
                sentVia: [],
                emailSent: false,
                smsSent: false,
            },
        });
    }
    return res.json({
        success: true,
        message: 'Cash payment confirmed',
        data: {
            order: updatedOrder,
        },
    });
}));
exports.default = router;
//# sourceMappingURL=payments.js.map