"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorHandler_1 = require("../middleware/errorHandler");
const pdf_1 = require("../lib/pdf");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.get('/invoice/:invoiceId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { invoiceId } = req.params;
    if (!invoiceId) {
        throw new errorHandler_1.AppError('Invoice ID is required', 400);
    }
    let invoice = await database_1.prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: {
            id: true,
            orderId: true,
            invoiceNumber: true,
            pdfData: true,
            pdfName: true,
            pdfPath: true,
            order: { select: { userId: true } },
        },
    });
    if (!invoice) {
        invoice = await database_1.prisma.invoice.findFirst({
            where: { orderId: invoiceId },
            select: {
                id: true,
                orderId: true,
                invoiceNumber: true,
                pdfData: true,
                pdfName: true,
                pdfPath: true,
                order: { select: { userId: true } },
            },
        });
    }
    if (!invoice) {
        throw new errorHandler_1.AppError('Invoice not found', 404);
    }
    let token;
    const authHeader = req.get('Authorization') || req.headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }
    if (!token) {
        if (invoice.pdfData) {
            const pdfBuffer = Buffer.from(invoice.pdfData);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${invoice.pdfName || 'invoice.pdf'}"`);
            res.setHeader('Content-Length', String(pdfBuffer.length));
            return res.send(pdfBuffer);
        }
        if (invoice.pdfPath && invoice.pdfPath.startsWith('http') && !(0, pdf_1.isPrivateBucket)()) {
            return res.redirect(invoice.pdfPath);
        }
        throw new errorHandler_1.AppError('Access denied. No token provided.', 401);
    }
    if (!process.env.JWT_SECRET) {
        throw new errorHandler_1.AppError('Server configuration error', 500);
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const userId = decoded?.id;
        if (!userId)
            throw new errorHandler_1.AppError('Invalid token', 401);
        if (invoice.order?.userId !== userId) {
            throw new errorHandler_1.AppError('Access denied. You do not own this invoice.', 403);
        }
        if (invoice.pdfData) {
            const pdfBuffer = Buffer.from(invoice.pdfData);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${invoice.pdfName || 'invoice.pdf'}"`);
            res.setHeader('Content-Length', String(pdfBuffer.length));
            return res.send(pdfBuffer);
        }
        if (invoice.pdfName) {
            if ((0, pdf_1.isPrivateBucket)()) {
                try {
                    const pdfBuffer = await (0, pdf_1.downloadPDFFromStorage)(invoice.pdfName);
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `inline; filename="${invoice.pdfName}"`);
                    res.setHeader('Content-Length', String(pdfBuffer.length));
                    return res.send(pdfBuffer);
                }
                catch (downloadError) {
                    logger_1.logger.warn('Failed to download PDF from B2, will regenerate', {
                        invoiceId,
                        error: downloadError instanceof Error ? downloadError.message : 'Unknown error',
                    });
                }
            }
            else {
                try {
                    const downloadUrl = await (0, pdf_1.getPDFDownloadUrl)(invoice.pdfName);
                    return res.redirect(downloadUrl);
                }
                catch (urlError) {
                    logger_1.logger.warn('Failed to get PDF download URL, will try direct download', {
                        invoiceId,
                        error: urlError instanceof Error ? urlError.message : 'Unknown error',
                    });
                    try {
                        const pdfBuffer = await (0, pdf_1.downloadPDFFromStorage)(invoice.pdfName);
                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', `inline; filename="${invoice.pdfName}"`);
                        res.setHeader('Content-Length', String(pdfBuffer.length));
                        return res.send(pdfBuffer);
                    }
                    catch (downloadError) {
                        logger_1.logger.error('Failed to download PDF from B2', {
                            invoiceId,
                            error: downloadError instanceof Error ? downloadError.message : 'Unknown error',
                        });
                    }
                }
            }
        }
        if (!invoice.orderId) {
            throw new errorHandler_1.AppError('PDF not available for this invoice', 404);
        }
        const fullInvoice = await database_1.prisma.invoice.findFirst({
            where: { id: invoice.id },
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
        if (!fullInvoice || !fullInvoice.order) {
            throw new errorHandler_1.AppError('Order not found for invoice', 404);
        }
        const order = fullInvoice.order;
        const invoiceNumber = fullInvoice.invoiceNumber || `INV-${Date.now()}-${order.id.substring(0, 8).toUpperCase()}`;
        const pdfBuffer = (0, pdf_1.generateInvoicePDF)({
            customerName: order.user?.name || '',
            customerEmail: order.user?.email || '',
            customerPhone: order.user?.phone || '',
            invoiceNumber,
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
        });
        const pdfFileName = `invoice-${invoiceNumber}.pdf`;
        const stored = await (0, pdf_1.savePDFToStorage)(pdfBuffer, pdfFileName);
        await database_1.prisma.invoice.update({
            where: { id: fullInvoice.id },
            data: { pdfPath: stored.pdfPath, pdfData: stored.pdfData, pdfName: stored.pdfName, invoiceNumber },
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${stored.pdfName || 'invoice.pdf'}"`);
        res.setHeader('Content-Length', String(pdfBuffer.length));
        return res.send(pdfBuffer);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            throw err;
        throw new errorHandler_1.AppError('Invalid token', 401);
    }
}));
exports.default = router;
//# sourceMappingURL=pdf.js.map