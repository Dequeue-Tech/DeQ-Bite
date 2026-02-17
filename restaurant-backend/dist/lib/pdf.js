"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoicePDF = generateInvoicePDF;
exports.savePDFToStorage = savePDFToStorage;
exports.cleanupOldInvoices = cleanupOldInvoices;
const jspdf_1 = __importDefault(require("jspdf"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const logger_1 = require("../utils/logger");
function generateInvoicePDF(invoiceData) {
    try {
        const doc = new jspdf_1.default();
        doc.setFont('helvetica');
        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text(invoiceData.restaurantName || 'Restaurant', 20, 25);
        doc.setFontSize(16);
        doc.text('INVOICE', 20, 40);
        doc.setFontSize(10);
        doc.text(`Invoice #: ${invoiceData.invoiceNumber}`, 140, 25);
        doc.text(`Date: ${invoiceData.orderDate}`, 140, 35);
        doc.text(`Table: ${invoiceData.tableNumber}`, 140, 45);
        doc.setFontSize(12);
        doc.text('Bill To:', 20, 60);
        doc.setFontSize(10);
        doc.text(invoiceData.customerName, 20, 70);
        if (invoiceData.customerEmail) {
            doc.text(invoiceData.customerEmail, 20, 80);
        }
        if (invoiceData.customerPhone) {
            doc.text(invoiceData.customerPhone, 20, 90);
        }
        const startY = 110;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Item', 20, startY);
        doc.text('Qty', 120, startY);
        doc.text('Price', 140, startY);
        doc.text('Total', 170, startY);
        doc.line(20, startY + 5, 190, startY + 5);
        doc.setFont('helvetica', 'normal');
        let currentY = startY + 15;
        invoiceData.items.forEach((item) => {
            doc.text(item.name, 20, currentY);
            doc.text(item.quantity.toString(), 120, currentY);
            doc.text(`₹${item.price.toFixed(2)}`, 140, currentY);
            doc.text(`₹${item.total.toFixed(2)}`, 170, currentY);
            currentY += 10;
        });
        currentY += 5;
        doc.line(20, currentY, 190, currentY);
        currentY += 10;
        doc.text('Subtotal:', 140, currentY);
        doc.text(`₹${invoiceData.subtotal.toFixed(2)}`, 170, currentY);
        currentY += 10;
        doc.text('Tax:', 140, currentY);
        doc.text(`₹${invoiceData.tax.toFixed(2)}`, 170, currentY);
        currentY += 10;
        doc.setFont('helvetica', 'bold');
        doc.text('Total:', 140, currentY);
        doc.text(`₹${invoiceData.total.toFixed(2)}`, 170, currentY);
        if (invoiceData.paymentMethod) {
            currentY += 20;
            doc.setFont('helvetica', 'normal');
            doc.text(`Payment Method: ${invoiceData.paymentMethod}`, 20, currentY);
        }
        currentY += 30;
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Thank you for dining with us!', 20, currentY);
        if (invoiceData.restaurantAddress) {
            currentY += 10;
            doc.text(invoiceData.restaurantAddress, 20, currentY);
        }
        if (invoiceData.restaurantPhone) {
            currentY += 10;
            doc.text(`Phone: ${invoiceData.restaurantPhone}`, 20, currentY);
        }
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        logger_1.logger.info('PDF invoice generated successfully', {
            invoiceNumber: invoiceData.invoiceNumber,
            customerName: invoiceData.customerName,
            total: invoiceData.total,
        });
        return pdfBuffer;
    }
    catch (error) {
        logger_1.logger.error('PDF generation failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            invoiceNumber: invoiceData.invoiceNumber,
        });
        throw new Error('Failed to generate PDF invoice');
    }
}
async function savePDFToStorage(pdfBuffer, filename) {
    try {
        const invoicesDir = path_1.default.join(process.cwd(), 'public', 'invoices');
        await promises_1.default.mkdir(invoicesDir, { recursive: true });
        const filePath = path_1.default.join(invoicesDir, filename);
        await promises_1.default.writeFile(filePath, pdfBuffer);
        logger_1.logger.info('PDF saved to storage', {
            filename,
            path: filePath,
        });
        return {
            pdfPath: `/invoices/${filename}`,
            pdfData: pdfBuffer,
            pdfName: filename,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to save PDF to storage', {
            error: error instanceof Error ? error.message : 'Unknown error',
            filename,
        });
        throw new Error('Failed to save PDF invoice');
    }
}
async function cleanupOldInvoices(daysOld = 30) {
    try {
        const invoicesDir = path_1.default.join(process.cwd(), 'public', 'invoices');
        const files = await promises_1.default.readdir(invoicesDir);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        let deletedCount = 0;
        for (const file of files) {
            const filePath = path_1.default.join(invoicesDir, file);
            const stats = await promises_1.default.stat(filePath);
            if (stats.mtime < cutoffDate) {
                await promises_1.default.unlink(filePath);
                deletedCount++;
            }
        }
        logger_1.logger.info('Old invoices cleaned up', {
            deletedCount,
            daysOld,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to cleanup old invoices', {
            error: error instanceof Error ? error.message : 'Unknown error',
            daysOld,
        });
    }
}
//# sourceMappingURL=pdf.js.map