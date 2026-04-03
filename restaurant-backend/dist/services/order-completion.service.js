"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processOrderCompletionNotifications = void 0;
const database_1 = require("../config/database");
const pdf_1 = require("../lib/pdf");
const email_1 = require("../lib/email");
const sms_1 = require("../lib/sms");
const realtime_1 = require("../utils/realtime");
const logger_1 = require("../utils/logger");
const order_contact_service_1 = require("../services/order-contact.service");
const DELIVERY_METHODS = ['EMAIL', 'SMS'];
const withRetries = async (label, fn, retries = 2) => {
    let attempt = 0;
    let lastError;
    while (attempt <= retries) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            attempt += 1;
            if (attempt > retries)
                break;
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        }
    }
    throw new Error(`${label} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
};
const logDeliveryResult = (input) => {
    const payload = {
        channel: input.channel,
        status: input.status,
        orderId: input.orderId,
        target: input.target,
        reason: input.reason,
        errorMessage: input.errorMessage,
        startedAt: input.startedAt,
        finishedAt: new Date().toISOString(),
    };
    if (input.status === 'failure') {
        logger_1.logger.error('ORDER_COMPLETION_DELIVERY', payload);
        return;
    }
    logger_1.logger.info('ORDER_COMPLETION_DELIVERY', payload);
};
const buildInvoiceData = (order, invoiceNumber, placementContact) => {
    const taxPercent = order.subtotalPaise > 0
        ? Math.round((order.taxPaise / order.subtotalPaise) * 100)
        : undefined;
    return {
        restaurantName: order.restaurant?.name ?? 'Restaurant',
        ...(order.restaurant?.address ? { restaurantAddress: order.restaurant.address } : {}),
        ...(order.restaurant?.city ? { restaurantCity: order.restaurant.city } : {}),
        ...(order.restaurant?.state ? { restaurantState: order.restaurant.state } : {}),
        ...(order.restaurant?.phone ? { restaurantPhone: order.restaurant.phone } : {}),
        ...(order.restaurant?.email ? { restaurantEmail: order.restaurant.email } : {}),
        ...(order.restaurant?.gstNumber ? { gstNumber: order.restaurant.gstNumber } : {}),
        ...(taxPercent !== undefined ? { taxPercent } : {}),
        customerName: placementContact.name || 'Guest',
        customerEmail: placementContact.email || '',
        ...(placementContact.phone ? { customerPhone: placementContact.phone } : {}),
        invoiceNumber,
        orderDate: order.createdAt.toLocaleDateString('en-IN'),
        items: (order.items || []).map((item) => ({
            name: item.menuItem?.name || 'Item',
            quantity: item.quantity,
            price: item.pricePaise / 100,
            total: (item.pricePaise * item.quantity) / 100,
        })),
        subtotal: order.subtotalPaise / 100,
        tax: order.taxPaise / 100,
        total: order.totalPaise / 100,
        tableNumber: order.table?.number ? String(order.table.number) : 'N/A',
        paymentMethod: `${order.paymentProvider || 'RAZORPAY'}`,
    };
};
const ensureInvoiceRecord = async (order) => {
    const existing = await database_1.prisma.invoice.findUnique({
        where: { orderId: order.id },
    });
    const invoiceNumber = existing?.invoiceNumber || `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;
    const placementContact = (0, order_contact_service_1.resolveOrderPlacementContact)(order);
    const invoiceData = buildInvoiceData(order, invoiceNumber, placementContact);
    if (existing?.pdfName && existing?.pdfPath) {
        return { invoice: existing, invoiceData, pdfBuffer: undefined };
    }
    const pdfBuffer = await withRetries('invoice-pdf-generate', async () => (0, pdf_1.generateInvoicePDF)(invoiceData));
    const pdfStorage = await withRetries('invoice-storage-upload', async () => (0, pdf_1.savePDFToStorage)(pdfBuffer, `invoice-${invoiceNumber}.pdf`));
    if (existing) {
        const updated = await database_1.prisma.invoice.update({
            where: { id: existing.id },
            data: {
                pdfPath: pdfStorage.pdfPath,
                pdfData: pdfStorage.pdfData,
                pdfName: pdfStorage.pdfName,
            },
        });
        return { invoice: updated, invoiceData, pdfBuffer };
    }
    const created = await database_1.prisma.invoice.create({
        data: {
            orderId: order.id,
            invoiceNumber,
            sentVia: [],
            emailSent: false,
            smsSent: false,
            pdfPath: pdfStorage.pdfPath,
            pdfData: pdfStorage.pdfData,
            pdfName: pdfStorage.pdfName,
        },
    });
    return { invoice: created, invoiceData, pdfBuffer };
};
const processOrderCompletionNotifications = async (orderId) => {
    const order = await database_1.prisma.order.findUnique({
        where: { id: orderId },
        include: {
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                    city: true,
                    state: true,
                    phone: true,
                    email: true,
                    gstNumber: true,
                },
            },
            table: { select: { number: true } },
            user: { select: { id: true, name: true, email: true, phone: true } },
            items: { include: { menuItem: { select: { name: true } } } },
            invoice: true,
        },
    });
    if (!order)
        return;
    if (order.status !== 'COMPLETED' || order.paymentStatus !== 'COMPLETED')
        return;
    const { invoice, invoiceData, pdfBuffer: generatedPdfBuffer } = await ensureInvoiceRecord(order);
    let invoiceUrl = invoice.pdfPath || null;
    if (invoice.pdfName) {
        try {
            invoiceUrl = await (0, pdf_1.getPDFDownloadUrl)(invoice.pdfName);
        }
        catch {
        }
    }
    let pdfBufferForEmail = generatedPdfBuffer ?? null;
    if (!pdfBufferForEmail && invoice.pdfData) {
        pdfBufferForEmail = Buffer.from(invoice.pdfData);
    }
    if (!pdfBufferForEmail) {
        pdfBufferForEmail = await withRetries('invoice-pdf-regenerate-email', async () => (0, pdf_1.generateInvoicePDF)(invoiceData));
    }
    let emailSent = invoice.emailSent;
    let smsSent = invoice.smsSent;
    const placementContact = (0, order_contact_service_1.resolveOrderPlacementContact)(order);
    const placedOrderEmail = placementContact.email;
    const placedOrderPhone = placementContact.phone;
    const placedOrderName = placementContact.name || 'Guest';
    if (!emailSent && placedOrderEmail) {
        const startedAt = new Date().toISOString();
        try {
            emailSent = await withRetries('invoice-email-send', async () => (0, email_1.sendOrderCompletionEmail)({
                to: placedOrderEmail,
                customerName: placedOrderName,
                restaurantName: order.restaurant?.name || 'Restaurant',
                invoiceNumber: invoice.invoiceNumber,
                orderId: order.id,
                totalInr: order.totalPaise / 100,
                orderDate: order.createdAt.toLocaleDateString('en-IN'),
                tableNumber: order.table?.number || 0,
            }, pdfBufferForEmail));
            logDeliveryResult({
                channel: 'email',
                status: emailSent ? 'success' : 'failure',
                orderId: order.id,
                target: placedOrderEmail,
                ...(emailSent ? {} : { reason: 'provider_returned_false' }),
                startedAt,
            });
        }
        catch (error) {
            logDeliveryResult({
                channel: 'email',
                status: 'failure',
                orderId: order.id,
                target: placedOrderEmail,
                errorMessage: error instanceof Error ? error.message : String(error),
                startedAt,
            });
        }
    }
    else if (!placedOrderEmail) {
        logDeliveryResult({
            channel: 'email',
            status: 'skipped',
            orderId: order.id,
            target: '',
            reason: 'missing_order_placement_email',
            startedAt: new Date().toISOString(),
        });
    }
    if (!smsSent && placedOrderPhone && invoiceUrl) {
        const startedAt = new Date().toISOString();
        try {
            smsSent = await withRetries('invoice-sms-send', async () => (0, sms_1.sendOrderCompletionSMS)(placedOrderPhone, {
                customerName: placedOrderName,
                restaurantName: order.restaurant?.name || 'Restaurant',
                invoiceNumber: invoice.invoiceNumber,
                total: order.totalPaise / 100,
                invoiceUrl,
            }));
            logDeliveryResult({
                channel: 'sms',
                status: smsSent ? 'success' : 'failure',
                orderId: order.id,
                target: placedOrderPhone,
                ...(smsSent ? {} : { reason: 'provider_returned_false' }),
                startedAt,
            });
        }
        catch (error) {
            logDeliveryResult({
                channel: 'sms',
                status: 'failure',
                orderId: order.id,
                target: placedOrderPhone,
                errorMessage: error instanceof Error ? error.message : String(error),
                startedAt,
            });
        }
    }
    else if (!placedOrderPhone) {
        logDeliveryResult({
            channel: 'sms',
            status: 'skipped',
            orderId: order.id,
            target: '',
            reason: 'missing_order_placement_phone',
            startedAt: new Date().toISOString(),
        });
    }
    else if (!invoiceUrl) {
        logDeliveryResult({
            channel: 'sms',
            status: 'skipped',
            orderId: order.id,
            target: placedOrderPhone,
            reason: 'missing_invoice_url',
            startedAt: new Date().toISOString(),
        });
    }
    const sentVia = Array.from(new Set([
        ...(invoice.sentVia || []),
        ...(emailSent ? ['EMAIL'] : []),
        ...(smsSent ? ['SMS'] : []),
    ]));
    const updatedInvoice = await database_1.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
            sentVia,
            emailSent,
            smsSent,
        },
    });
    (0, realtime_1.emitRestaurantEvent)(order.restaurantId, {
        type: 'invoice.ready',
        userId: order.userId,
        payload: {
            orderId: order.id,
            invoiceId: updatedInvoice.id,
            invoiceNumber: updatedInvoice.invoiceNumber,
            invoiceUrl,
            delivery: {
                emailSent,
                smsSent,
            },
        },
    });
    logger_1.logger.info('Order completion workflow processed', {
        orderId: order.id,
        restaurantId: order.restaurantId,
        userId: order.userId,
        deliveredVia: sentVia,
        availableMethods: DELIVERY_METHODS,
    });
};
exports.processOrderCompletionNotifications = processOrderCompletionNotifications;
//# sourceMappingURL=order-completion.service.js.map