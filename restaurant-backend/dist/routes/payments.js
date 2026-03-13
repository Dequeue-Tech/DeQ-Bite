"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const payments_1 = require("../lib/payments");
const logger_1 = require("../utils/logger");
const audit_1 = require("../utils/audit");
const pdf_1 = require("../lib/pdf");
const restaurant_1 = require("../middleware/restaurant");
const realtime_1 = require("../utils/realtime");
const router = (0, express_1.Router)();
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
const cashConfirmSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(1, 'Order ID is required'),
    amountPaise: zod_1.z.number().int().positive().optional(),
});
const updatePaymentStatusSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(1, 'Order ID is required'),
    paymentStatus: zod_1.z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_PAID']),
    paidAmountPaise: zod_1.z.number().int().nonnegative().optional(),
});
const computeDueAndStatus = (totalPaise, paidAmountPaise) => {
    const boundedPaid = Math.max(0, Math.min(paidAmountPaise, totalPaise));
    const dueAmountPaise = Math.max(totalPaise - boundedPaid, 0);
    const paymentStatus = dueAmountPaise === 0
        ? 'COMPLETED'
        : boundedPaid > 0
            ? 'PARTIALLY_PAID'
            : 'PENDING';
    return {
        paidAmountPaise: boundedPaid,
        dueAmountPaise,
        paymentStatus,
    };
};
const ensureInvoiceAndEarningForFullyPaidOrder = async (orderId) => {
    const order = await database_1.prisma.order.findUnique({
        where: { id: orderId },
        include: {
            restaurant: {
                select: {
                    name: true,
                    address: true,
                    phone: true,
                    commissionRate: true,
                },
            },
            table: {
                select: {
                    number: true,
                },
            },
            user: {
                select: {
                    name: true,
                    email: true,
                    phone: true,
                },
            },
            items: {
                include: {
                    menuItem: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        },
    });
    if (!order || order.paymentStatus !== 'COMPLETED')
        return;
    const existingInvoice = await database_1.prisma.invoice.findUnique({
        where: { orderId: order.id },
    });
    if (!existingInvoice) {
        const invoiceNumber = `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;
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
            restaurantName: order.restaurant.name,
            paymentMethod: `Payment (${order.paymentProvider})`,
            ...(order.restaurant.address ? { restaurantAddress: order.restaurant.address } : {}),
            ...(order.restaurant.phone ? { restaurantPhone: order.restaurant.phone } : {}),
        };
        const pdfBuffer = (0, pdf_1.generateInvoicePDF)(invoiceData);
        const pdfFileName = `invoice-${invoiceNumber}.pdf`;
        const pdfStorageResult = await (0, pdf_1.savePDFToStorage)(pdfBuffer, pdfFileName);
        await database_1.prisma.invoice.create({
            data: {
                orderId: order.id,
                invoiceNumber,
                sentVia: [],
                emailSent: false,
                smsSent: false,
                pdfPath: pdfStorageResult.pdfPath,
                pdfData: pdfStorageResult.pdfData,
                pdfName: pdfStorageResult.pdfName,
            },
        });
    }
    const existingEarning = await database_1.prisma.earning.findUnique({
        where: {
            orderId: order.id,
        },
    });
    if (!existingEarning) {
        const platformCommissionPaise = Math.round(order.totalPaise * (order.restaurant.commissionRate / 100));
        const restaurantEarningPaise = order.totalPaise - platformCommissionPaise;
        await database_1.prisma.earning.create({
            data: {
                restaurantId: order.restaurantId,
                orderId: order.id,
                grossAmountPaise: order.totalPaise,
                platformCommissionPaise,
                restaurantEarningPaise,
            },
        });
    }
};
const buildOrderEventPayload = (order) => ({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentProvider: order.paymentProvider,
    paidAmountPaise: order.paidAmountPaise,
    dueAmountPaise: order.dueAmountPaise,
    totalPaise: order.totalPaise,
    updatedAt: order.updatedAt,
    createdAt: order.createdAt,
});
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
router.post('/create', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId, paymentProvider } = createPaymentSchema.parse(req.body);
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
            restaurantId: req.restaurant.id,
            paymentStatus: {
                in: ['PENDING', 'FAILED', 'PROCESSING', 'PARTIALLY_PAID'],
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
    if ((order.dueAmountPaise || 0) <= 0) {
        throw new errorHandler_1.AppError('Order is already fully paid', 400);
    }
    const providerToUse = (paymentProvider || order.paymentProvider || 'RAZORPAY');
    const provider = (0, payments_1.getPaymentProvider)(providerToUse);
    if (!provider.isEnabled()) {
        throw new errorHandler_1.AppError(`${providerToUse} is not enabled`, 400);
    }
    const paymentOrder = await provider.createOrder({
        amountPaise: order.dueAmountPaise || order.totalPaise,
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
        amountPaise: paymentOrder.amountPaise,
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
}));
router.post('/verify', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verifyPaymentSchema.parse(req.body);
    const order = await database_1.prisma.order.findFirst({
        where: {
            paymentId: razorpay_order_id,
            userId: req.user.id,
            restaurantId: req.restaurant.id,
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found. Payment reference does not match any order.', 404);
    }
    if (order.paymentStatus === 'COMPLETED') {
        const response = {
            success: true,
            message: 'Payment already verified',
            data: { order },
        };
        return res.json(response);
    }
    const provider = (0, payments_1.getPaymentProvider)(order.paymentProvider);
    await provider.verifyPayment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
    });
    const amountPaidNow = order.dueAmountPaise || Math.max(order.totalPaise - order.paidAmountPaise, 0);
    const nextPaid = order.paidAmountPaise + amountPaidNow;
    const computed = computeDueAndStatus(order.totalPaise, nextPaid);
    const [, updatedOrder] = await database_1.prisma.$transaction([
        database_1.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: computed.paymentStatus,
                paidAmountPaise: computed.paidAmountPaise,
                dueAmountPaise: computed.dueAmountPaise,
                status: computed.dueAmountPaise === 0 ? 'CONFIRMED' : order.status,
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
        }),
        database_1.prisma.payment.create({
            data: {
                orderId: order.id,
                userId: order.userId,
                restaurantId: order.restaurantId,
                method: 'ONLINE',
                provider: order.paymentProvider,
                amountPaise: amountPaidNow,
                status: computed.paymentStatus,
                providerOrderId: razorpay_order_id,
                providerPaymentId: razorpay_payment_id,
                providerSignature: razorpay_signature,
            },
        }),
    ]);
    await (0, audit_1.safeCreateAuditLog)({
        actorUserId: req.user.id,
        restaurantId: order.restaurantId,
        action: 'PAYMENT_VERIFIED',
        entityType: 'order',
        entityId: order.id,
        metadata: {
            amountPaidNow,
            paymentStatus: computed.paymentStatus,
            dueAmountPaise: computed.dueAmountPaise,
            providerPaymentId: razorpay_payment_id,
        },
    });
    await ensureInvoiceAndEarningForFullyPaidOrder(order.id);
    (0, realtime_1.emitRestaurantEvent)(order.restaurantId, {
        type: 'order.updated',
        payload: buildOrderEventPayload(updatedOrder),
    });
    const response = {
        success: true,
        message: computed.paymentStatus === 'COMPLETED' ? 'Payment verified successfully' : 'Partial payment verified successfully',
        data: {
            order: updatedOrder,
            paymentId: razorpay_payment_id,
        },
    };
    return res.json(response);
}));
router.post('/refund', auth_1.authenticate, restaurant_1.requireRestaurant, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { orderId, amount, reason } = refundPaymentSchema.parse(req.body);
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: orderId,
            userId: req.user.id,
            restaurantId: req.restaurant.id,
            paymentStatus: {
                in: ['COMPLETED', 'PARTIALLY_PAID'],
            },
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found or payment not completed', 404);
    }
    if (!order.paymentTransactionId) {
        throw new errorHandler_1.AppError('No payment transaction ID found for this order', 400);
    }
    const refundAmountPaise = amount ? Math.round(amount * 100) : order.paidAmountPaise;
    const provider = (0, payments_1.getPaymentProvider)(order.paymentProvider);
    const refund = await provider.refund(order.paymentTransactionId, refundAmountPaise, reason || 'Customer requested refund');
    const nextPaid = Math.max(order.paidAmountPaise - refundAmountPaise, 0);
    const computed = computeDueAndStatus(order.totalPaise, nextPaid);
    await database_1.prisma.$transaction([
        database_1.prisma.order.update({
            where: { id: orderId },
            data: {
                paymentStatus: nextPaid === 0 ? 'REFUNDED' : computed.paymentStatus,
                paidAmountPaise: computed.paidAmountPaise,
                dueAmountPaise: computed.dueAmountPaise,
                status: nextPaid === 0 ? 'CANCELLED' : order.status,
                updatedAt: new Date(),
            },
        }),
        database_1.prisma.payment.create({
            data: {
                orderId: order.id,
                userId: order.userId,
                restaurantId: order.restaurantId,
                method: 'ONLINE',
                provider: order.paymentProvider,
                amountPaise: -refundAmountPaise,
                status: 'REFUNDED',
                providerPaymentId: refund.id,
                notes: reason || 'Refund',
            },
        }),
    ]);
    await (0, audit_1.safeCreateAuditLog)({
        actorUserId: req.user.id,
        restaurantId: order.restaurantId,
        action: 'PAYMENT_REFUNDED',
        entityType: 'order',
        entityId: order.id,
        metadata: {
            refundAmountPaise,
            refundId: refund.id,
            reason,
        },
    });
    (0, realtime_1.emitRestaurantEvent)(order.restaurantId, {
        type: 'order.updated',
        payload: buildOrderEventPayload({
            id: order.id,
            status: nextPaid === 0 ? 'CANCELLED' : order.status,
            paymentStatus: nextPaid === 0 ? 'REFUNDED' : computed.paymentStatus,
            paymentProvider: order.paymentProvider,
            paidAmountPaise: computed.paidAmountPaise,
            dueAmountPaise: computed.dueAmountPaise,
            totalPaise: order.totalPaise,
            updatedAt: new Date(),
            createdAt: order.createdAt,
        }),
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
            paidAmountPaise: true,
            dueAmountPaise: true,
            createdAt: true,
            updatedAt: true,
            payments: {
                orderBy: {
                    createdAt: 'desc',
                },
                select: {
                    id: true,
                    amountPaise: true,
                    method: true,
                    provider: true,
                    status: true,
                    createdAt: true,
                },
            },
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
    const payload = cashConfirmSchema.parse(req.body);
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: payload.orderId,
            restaurantId: req.restaurant.id,
            paymentProvider: 'CASH',
            paymentStatus: {
                in: ['PENDING', 'PROCESSING', 'FAILED', 'PARTIALLY_PAID'],
            },
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Cash order not found or already fully paid', 404);
    }
    const amountToAdd = Math.min(payload.amountPaise ?? order.dueAmountPaise, order.dueAmountPaise);
    const nextPaid = order.paidAmountPaise + amountToAdd;
    const computed = computeDueAndStatus(order.totalPaise, nextPaid);
    const [, updatedOrder] = await database_1.prisma.$transaction([
        database_1.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: computed.paymentStatus,
                paidAmountPaise: computed.paidAmountPaise,
                dueAmountPaise: computed.dueAmountPaise,
                status: computed.dueAmountPaise === 0 && order.status === 'PENDING' ? 'CONFIRMED' : order.status,
                paymentTransactionId: computed.dueAmountPaise === 0 ? `cash-${Date.now()}` : order.paymentTransactionId,
                updatedAt: new Date(),
            },
        }),
        database_1.prisma.payment.create({
            data: {
                orderId: order.id,
                userId: order.userId,
                restaurantId: order.restaurantId,
                method: 'CASH',
                provider: 'CASH',
                amountPaise: amountToAdd,
                status: computed.paymentStatus,
                notes: 'Cash payment confirmed by restaurant admin',
            },
        }),
    ]);
    await (0, audit_1.safeCreateAuditLog)({
        actorUserId: req.user.id,
        restaurantId: order.restaurantId,
        action: 'CASH_PAYMENT_CONFIRMED',
        entityType: 'order',
        entityId: order.id,
        metadata: {
            amountToAdd,
            paymentStatus: computed.paymentStatus,
            dueAmountPaise: computed.dueAmountPaise,
        },
    });
    await ensureInvoiceAndEarningForFullyPaidOrder(order.id);
    (0, realtime_1.emitRestaurantEvent)(order.restaurantId, {
        type: 'order.updated',
        payload: buildOrderEventPayload(updatedOrder),
    });
    return res.json({
        success: true,
        message: computed.paymentStatus === 'COMPLETED' ? 'Cash payment fully confirmed' : 'Cash partial payment confirmed',
        data: {
            order: updatedOrder,
        },
    });
}));
router.put('/status', auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const payload = updatePaymentStatusSchema.parse(req.body);
    const order = await database_1.prisma.order.findFirst({
        where: {
            id: payload.orderId,
            restaurantId: req.restaurant.id,
        },
    });
    if (!order) {
        throw new errorHandler_1.AppError('Order not found', 404);
    }
    const totalPaise = order.totalPaise;
    let paidAmountPaise = order.paidAmountPaise;
    if (payload.paymentStatus === 'COMPLETED') {
        paidAmountPaise = totalPaise;
    }
    else if (payload.paymentStatus === 'PARTIALLY_PAID') {
        if (typeof payload.paidAmountPaise !== 'number') {
            throw new errorHandler_1.AppError('paidAmountPaise is required for PARTIALLY_PAID', 400);
        }
        if (payload.paidAmountPaise <= 0 || payload.paidAmountPaise >= totalPaise) {
            throw new errorHandler_1.AppError('paidAmountPaise must be between 1 and total-1 for PARTIALLY_PAID', 400);
        }
        paidAmountPaise = payload.paidAmountPaise;
    }
    else if (payload.paymentStatus === 'REFUNDED') {
        paidAmountPaise = 0;
    }
    else if (typeof payload.paidAmountPaise === 'number') {
        paidAmountPaise = Math.max(0, Math.min(payload.paidAmountPaise, totalPaise));
    }
    else if (payload.paymentStatus === 'FAILED') {
        paidAmountPaise = 0;
    }
    const computed = computeDueAndStatus(totalPaise, paidAmountPaise);
    const shouldAutoConfirm = computed.dueAmountPaise === 0 && order.status === 'PENDING';
    const [updatedOrder] = await database_1.prisma.$transaction([
        database_1.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: payload.paymentStatus,
                paidAmountPaise: computed.paidAmountPaise,
                dueAmountPaise: computed.dueAmountPaise,
                status: shouldAutoConfirm ? 'CONFIRMED' : order.status,
                updatedAt: new Date(),
            },
        }),
    ]);
    await (0, audit_1.safeCreateAuditLog)({
        actorUserId: req.user.id,
        restaurantId: order.restaurantId,
        action: 'PAYMENT_STATUS_UPDATED',
        entityType: 'order',
        entityId: order.id,
        metadata: {
            paymentStatus: payload.paymentStatus,
            paidAmountPaise: computed.paidAmountPaise,
            dueAmountPaise: computed.dueAmountPaise,
        },
    });
    if (payload.paymentStatus === 'COMPLETED') {
        await ensureInvoiceAndEarningForFullyPaidOrder(order.id);
    }
    (0, realtime_1.emitRestaurantEvent)(order.restaurantId, {
        type: 'order.updated',
        payload: buildOrderEventPayload(updatedOrder),
    });
    return res.json({
        success: true,
        message: 'Payment status updated',
        data: { order: updatedOrder },
    });
}));
exports.default = router;
//# sourceMappingURL=payments.js.map