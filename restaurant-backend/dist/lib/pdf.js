"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPrivateBucket = void 0;
exports.generateInvoicePDF = generateInvoicePDF;
exports.savePDFToStorage = savePDFToStorage;
exports.downloadPDFFromStorage = downloadPDFFromStorage;
exports.getPDFDownloadUrl = getPDFDownloadUrl;
exports.cleanupOldInvoices = cleanupOldInvoices;
const jspdf_1 = __importDefault(require("jspdf"));
const logger_1 = require("@/utils/logger");
const b2_storage_1 = require("./b2-storage");
exports.isPrivateBucket = b2_storage_1.isPrivateBucket;
const COLOR_DARK = '#1A1A2E';
const COLOR_ACCENT = '#E94560';
const COLOR_LIGHT = '#F5F5F5';
const COLOR_MID = '#AAAAAA';
function fillRect(doc, x, y, w, h, hexColor) {
    doc.setFillColor(hexColor);
    doc.rect(x, y, w, h, 'F');
}
function hRule(doc, y, color, lineWidth = 0.4, x1 = 4, x2 = 76) {
    doc.setDrawColor(color);
    doc.setLineWidth(lineWidth);
    doc.line(x1, y, x2, y);
}
function dottedRule(doc, y, x1 = 4, x2 = 76) {
    doc.setDrawColor(COLOR_MID);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([0.5, 1.5], 0);
    doc.line(x1, y, x2, y);
    doc.setLineDashPattern([], 0);
}
function infoRow(doc, label, value, x, y, labelWidth = 18) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(COLOR_MID);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_DARK);
    doc.text(value, x + labelWidth, y);
}
function totalsRow(doc, label, value, y, bold = false, valueColor = COLOR_DARK) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8);
    doc.setTextColor(bold ? COLOR_DARK : COLOR_MID);
    doc.text(label, 4, y);
    doc.setTextColor(valueColor);
    doc.text(value, 76, y, { align: 'right' });
}
function generateInvoicePDF(invoiceData) {
    try {
        const PAGE_W = 80;
        const doc = new jspdf_1.default({ orientation: 'portrait', unit: 'mm', format: [PAGE_W, 260] });
        const CX = PAGE_W / 2;
        const M = 4;
        const R = PAGE_W - M;
        const COL2 = PAGE_W / 2;
        let y = 0;
        const HEADER_H = 38;
        fillRect(doc, 0, 0, PAGE_W, HEADER_H, COLOR_DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor('#FFFFFF');
        doc.text(invoiceData.restaurantName.toUpperCase(), CX, 12, { align: 'center' });
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(COLOR_ACCENT);
        doc.text(invoiceData.restaurantTagline || 'Fine Dining & Hospitality', CX, 16.5, { align: 'center' });
        doc.setDrawColor(COLOR_ACCENT);
        doc.setLineWidth(0.6);
        doc.line(10, 18.5, 70, 18.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor('#CCCCCC');
        let addrY = 22;
        if (invoiceData.restaurantAddress) {
            const lines = doc.splitTextToSize(invoiceData.restaurantAddress, 65);
            doc.text(lines, CX, addrY, { align: 'center' });
            addrY += lines.length * 3.5;
        }
        if (invoiceData.restaurantCity || invoiceData.restaurantState) {
            const cityState = [invoiceData.restaurantCity, invoiceData.restaurantState]
                .filter(Boolean).join(', ');
            doc.text(cityState, CX, addrY, { align: 'center' });
            addrY += 3.5;
        }
        const contactParts = [];
        if (invoiceData.restaurantPhone)
            contactParts.push(`Ph: ${invoiceData.restaurantPhone}`);
        if (invoiceData.restaurantEmail)
            contactParts.push(invoiceData.restaurantEmail);
        if (contactParts.length) {
            doc.text(contactParts.join('  |  '), CX, addrY, { align: 'center' });
        }
        if (invoiceData.gstNumber) {
            doc.setFontSize(6.5);
            doc.setTextColor('#999999');
            doc.text(`GSTIN: ${invoiceData.gstNumber}`, CX, 32.5, { align: 'center' });
        }
        y = HEADER_H;
        fillRect(doc, 0, y, PAGE_W, 6, COLOR_ACCENT);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor('#FFFFFF');
        doc.text('TAX INVOICE', CX, y + 4.2, { align: 'center' });
        y += 6;
        y += 3;
        doc.setTextColor(COLOR_DARK);
        infoRow(doc, 'Customer:', invoiceData.customerName || '-', M, y);
        y += 4;
        infoRow(doc, 'Mobile:', invoiceData.customerPhone || '-', M, y);
        y += 4;
        infoRow(doc, 'Date:', invoiceData.orderDate, M, y);
        if (invoiceData.orderTime) {
            infoRow(doc, 'Time:', invoiceData.orderTime, COL2, y, 10);
        }
        y += 4;
        infoRow(doc, 'Table:', invoiceData.tableNumber || '-', M, y);
        infoRow(doc, 'Cashier:', invoiceData.cashierName || '-', COL2, y, 12);
        y += 4;
        const shortBill = invoiceData.invoiceNumber.slice(-10);
        infoRow(doc, 'Bill No:', shortBill, M, y);
        if (invoiceData.paymentMode) {
            infoRow(doc, 'Mode:', invoiceData.paymentMode, COL2, y, 10);
        }
        y += 5;
        hRule(doc, y, COLOR_DARK, 0.8);
        y += 1;
        fillRect(doc, M, y, PAGE_W - 2 * M, 6.5, COLOR_LIGHT);
        y += 1;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(COLOR_DARK);
        doc.text('#', M + 1, y + 4);
        doc.text('ITEM', M + 6, y + 4);
        doc.text('QTY', 44, y + 4);
        doc.text('PRICE', 53, y + 4);
        doc.text('AMOUNT', R, y + 4, { align: 'right' });
        y += 6.5;
        hRule(doc, y, COLOR_ACCENT, 0.6);
        y += 5.5;
        let totalQty = 0;
        invoiceData.items.forEach((item, idx) => {
            totalQty += item.quantity;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(COLOR_DARK);
            doc.text(`${idx + 1}`, M + 1, y);
            doc.setFont('helvetica', 'normal');
            const nameLines = doc.splitTextToSize(item.name, 28);
            doc.text(nameLines, M + 6, y);
            doc.text(item.quantity.toString(), 44, y);
            doc.text(item.price.toFixed(2), 53, y);
            doc.text(item.total.toFixed(2), R, y, { align: 'right' });
            y += nameLines.length * 4.5;
            dottedRule(doc, y);
            y += 4;
        });
        hRule(doc, y, COLOR_DARK, 0.8);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(COLOR_MID);
        doc.text(`Total Qty: ${totalQty}`, M, y);
        totalsRow(doc, 'Sub Total', `INR ${invoiceData.subtotal.toFixed(2)}`, y);
        y += 5;
        if (invoiceData.discount && invoiceData.discount > 0) {
            totalsRow(doc, 'Discount', `- INR ${invoiceData.discount.toFixed(2)}`, y, false, COLOR_ACCENT);
            y += 5;
        }
        const taxLabel = invoiceData.taxPercent ? `GST (${invoiceData.taxPercent}%)` : 'GST';
        totalsRow(doc, taxLabel, `INR ${invoiceData.tax.toFixed(2)}`, y);
        y += 6;
        fillRect(doc, 0, y - 2, PAGE_W, 10, COLOR_DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor('#FFFFFF');
        doc.text('GRAND TOTAL', M + 2, y + 4.5);
        doc.setFontSize(11);
        doc.setTextColor(COLOR_ACCENT);
        doc.text(`INR ${invoiceData.total.toFixed(2)}`, R, y + 4.5, { align: 'right' });
        y += 12;
        if (invoiceData.amountPaid !== undefined) {
            totalsRow(doc, 'Amount Paid', `INR ${invoiceData.amountPaid.toFixed(2)}`, y);
            y += 5;
        }
        if (invoiceData.changeReturned !== undefined) {
            totalsRow(doc, 'Change Returned', `INR ${invoiceData.changeReturned.toFixed(2)}`, y);
            y += 5;
        }
        hRule(doc, y, COLOR_DARK, 0.8);
        y += 6;
        if (invoiceData.fssaiNumber) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(COLOR_MID);
            doc.text(`FSSAI Lic No.: ${invoiceData.fssaiNumber}`, CX, y, { align: 'center' });
            y += 5;
        }
        hRule(doc, y, COLOR_MID, 0.3);
        y += 6;
        const footerLines = (invoiceData.footerMessage || 'Thank you for dining with us!\nWe hope to see you again soon.')
            .split('\n');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(COLOR_DARK);
        footerLines.forEach(line => {
            doc.text(line, CX, y, { align: 'center' });
            y += 4.5;
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(COLOR_MID);
        doc.text('Powered by BillingPro v2.1', CX, y + 2, { align: 'center' });
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
        if (!(0, b2_storage_1.isB2Configured)()) {
            logger_1.logger.error('Backblaze B2 is not configured');
            throw new Error('Cloud storage not configured');
        }
        const b2FileName = `invoices/${filename}`;
        const uploadResult = await (0, b2_storage_1.uploadToB2)(pdfBuffer, b2FileName, 'application/pdf');
        logger_1.logger.info('PDF saved to B2 cloud storage', {
            filename,
            b2FileId: uploadResult.fileId,
            publicUrl: uploadResult.publicUrl,
        });
        return {
            pdfPath: uploadResult.publicUrl,
            pdfData: pdfBuffer,
            pdfName: filename,
            b2FileId: uploadResult.fileId,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to save PDF to B2 storage', {
            error: error instanceof Error ? error.message : 'Unknown error',
            filename,
        });
        throw new Error('Failed to save PDF invoice to cloud storage');
    }
}
async function downloadPDFFromStorage(fileName) {
    try {
        const b2FileName = fileName.startsWith('invoices/') ? fileName : `invoices/${fileName}`;
        const pdfBuffer = await (0, b2_storage_1.downloadFromB2)(b2FileName);
        logger_1.logger.info('PDF downloaded from B2 storage', {
            fileName: b2FileName,
            size: pdfBuffer.length,
        });
        return pdfBuffer;
    }
    catch (error) {
        logger_1.logger.error('Failed to download PDF from B2 storage', {
            error: error instanceof Error ? error.message : 'Unknown error',
            fileName,
        });
        throw new Error('Failed to download PDF from cloud storage');
    }
}
async function getPDFDownloadUrl(fileName) {
    try {
        const b2FileName = fileName.startsWith('invoices/') ? fileName : `invoices/${fileName}`;
        if ((0, b2_storage_1.isPrivateBucket)()) {
            return await (0, b2_storage_1.getSignedDownloadUrl)(b2FileName, 3600);
        }
        const bucketName = process.env['B2_BUCKET_NAME'];
        if (!bucketName) {
            throw new Error('B2_BUCKET_NAME not configured');
        }
        return `https://f000.backblazeb2.com/file/${bucketName}/${b2FileName}`;
    }
    catch (error) {
        logger_1.logger.error('Failed to get PDF download URL', {
            error: error instanceof Error ? error.message : 'Unknown error',
            fileName,
        });
        throw new Error('Failed to get PDF download URL');
    }
}
async function cleanupOldInvoices(daysOld = 30) {
    try {
        if (!(0, b2_storage_1.isB2Configured)()) {
            logger_1.logger.warn('B2 not configured, skipping cleanup');
            return;
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const cutoffTimestamp = cutoffDate.getTime();
        const files = await (0, b2_storage_1.listFilesInB2)('invoices/');
        let deletedCount = 0;
        for (const file of files) {
            if (file.uploadTimestamp < cutoffTimestamp) {
                await (0, b2_storage_1.deleteFromB2)(file.fileId, file.fileName);
                deletedCount++;
            }
        }
        logger_1.logger.info('Old invoices cleaned up from B2', {
            deletedCount,
            daysOld,
            totalFiles: files.length,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to cleanup old invoices from B2', {
            error: error instanceof Error ? error.message : 'Unknown error',
            daysOld,
        });
    }
}
//# sourceMappingURL=pdf.js.map