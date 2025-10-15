"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoicePDF = generateInvoicePDF;
exports.savePDFToStorage = savePDFToStorage;
const pdfkit_1 = __importDefault(require("pdfkit"));
const get_stream_1 = __importDefault(require("get-stream"));
const logger_1 = require("../utils/logger");
async function generateInvoicePDF(invoiceData) {
    const doc = new pdfkit_1.default({ size: 'A4', margin: 40 });
    try {
        const stream = doc;
        doc.fontSize(20).fillColor('#282828').text(invoiceData.restaurantName || 'Restaurant', { align: 'left' });
        doc.moveDown(0.5);
        doc.fontSize(16).text('INVOICE', { align: 'left' });
        doc.fontSize(10).fillColor('#444');
        doc.text(`Invoice #: ${invoiceData.invoiceNumber}`, 400, 50, { width: 150 });
        doc.text(`Date: ${invoiceData.orderDate}`, 400, 65, { width: 150 });
        doc.text(`Table: ${invoiceData.tableNumber}`, 400, 80, { width: 150 });
        doc.moveDown(1);
        doc.fontSize(12).fillColor('#000').text('Bill To:');
        doc.fontSize(10).text(invoiceData.customerName || '');
        if (invoiceData.customerEmail)
            doc.text(invoiceData.customerEmail);
        if (invoiceData.customerPhone)
            doc.text(invoiceData.customerPhone);
        doc.moveDown(1);
        const tableTop = doc.y + 10;
        doc.font('Helvetica-Bold');
        doc.fontSize(10);
        doc.text('Item', 40, tableTop);
        doc.text('Qty', 320, tableTop);
        doc.text('Price', 370, tableTop);
        doc.text('Total', 450, tableTop);
        doc.moveTo(40, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        doc.font('Helvetica').fontSize(10);
        let y = tableTop + 25;
        invoiceData.items.forEach((item) => {
            doc.text(item.name, 40, y, { width: 260 });
            doc.text(String(item.quantity), 320, y);
            doc.text(`${item.price.toFixed(2)}`.replace('\u0010', '\u20b9'), 370, y);
            doc.text(`${item.total.toFixed(2)}`.replace('\u0010', '\u20b9'), 450, y);
            y += 20;
            if (y > 700) {
                doc.addPage();
                y = 50;
            }
        });
        y += 10;
        doc.moveTo(320, y).lineTo(550, y).stroke();
        y += 10;
        doc.font('Helvetica').text('Subtotal:', 370, y);
        doc.text(`${invoiceData.subtotal.toFixed(2)}`.replace('\u0010', '\u20b9'), 450, y);
        y += 15;
        doc.text('Tax:', 370, y);
        doc.text(`${invoiceData.tax.toFixed(2)}`.replace('\u0010', '\u20b9'), 450, y);
        y += 15;
        doc.font('Helvetica-Bold').text('Total:', 370, y);
        doc.text(`${invoiceData.total.toFixed(2)}`.replace('\u0010', '\u20b9'), 450, y);
        if (invoiceData.paymentMethod) {
            y += 25;
            doc.font('Helvetica').fontSize(10).text(`Payment Method: ${invoiceData.paymentMethod}`, 40, y);
        }
        doc.moveDown(2);
        doc.fontSize(9).fillColor('#666').text('Thank you for dining with us!', { align: 'left' });
        if (invoiceData.restaurantAddress)
            doc.text(invoiceData.restaurantAddress, { align: 'left' });
        if (invoiceData.restaurantPhone)
            doc.text(`Phone: ${invoiceData.restaurantPhone}`, { align: 'left' });
        doc.end();
        const buffer = await get_stream_1.default.buffer(stream);
        logger_1.logger.info('PDF invoice generated successfully', {
            invoiceNumber: invoiceData.invoiceNumber,
            customerName: invoiceData.customerName,
            total: invoiceData.total,
            size: buffer.length,
        });
        return buffer;
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
        logger_1.logger.info('PDF prepared for database storage', {
            filename,
            size: pdfBuffer.length,
        });
        return {
            pdfPath: null,
            pdfData: pdfBuffer,
            pdfName: filename,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to prepare PDF for database storage', {
            error: error instanceof Error ? error.message : 'Unknown error',
            filename,
        });
        throw new Error('Failed to prepare PDF for database storage');
    }
}
//# sourceMappingURL=pdf.js.map