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
const logger_1 = require("../utils/logger");
const b2_storage_1 = require("./b2-storage");
exports.isPrivateBucket = b2_storage_1.isPrivateBucket;
const PAGE_W = 80;
const M = 4;
const R = PAGE_W - M;
function drawDashedLine(doc, y) {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(M, y, R, y);
    doc.setLineDashPattern([], 0);
}
function setFont(doc, weight, size) {
    doc.setFont('helvetica', weight);
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
}
function generateInvoicePDF(invoiceData) {
    try {
        const doc = new jspdf_1.default({ orientation: 'portrait', unit: 'mm', format: [PAGE_W, 297] });
        const CX = PAGE_W / 2;
        let y = 8;
        setFont(doc, 'bold', 12);
        doc.text(invoiceData.restaurantName.toUpperCase(), CX, y, { align: 'center' });
        y += 4;
        setFont(doc, 'normal', 8);
        if (invoiceData.restaurantTagline) {
            doc.text(invoiceData.restaurantTagline, CX, y, { align: 'center' });
            y += 4;
        }
        if (invoiceData.restaurantAddress) {
            const addressLines = doc.splitTextToSize(invoiceData.restaurantAddress, 70);
            doc.text(addressLines, CX, y, { align: 'center' });
            y += addressLines.length * 3.5;
        }
        if (invoiceData.restaurantCity || invoiceData.restaurantState) {
            const cityState = [invoiceData.restaurantCity, invoiceData.restaurantState].filter(Boolean).join(', ');
            doc.text(cityState, CX, y, { align: 'center' });
            y += 3.5;
        }
        if (invoiceData.restaurantPhone) {
            doc.text(`Ph: ${invoiceData.restaurantPhone}`, CX, y, { align: 'center' });
            y += 3.5;
        }
        if (invoiceData.gstNumber) {
            doc.text(`GSTIN: ${invoiceData.gstNumber}`, CX, y, { align: 'center' });
            y += 4;
        }
        y += 2;
        drawDashedLine(doc, y);
        y += 4;
        setFont(doc, 'bold', 9);
        doc.text('TAX INVOICE', CX, y, { align: 'center' });
        y += 5;
        setFont(doc, 'normal', 8);
        doc.text(`Bill No: ${invoiceData.invoiceNumber.slice(-8)}`, M, y);
        doc.text(`Date: ${invoiceData.orderDate}`, R, y, { align: 'right' });
        y += 4;
        doc.text(`Table: ${invoiceData.tableNumber || '-'}`, M, y);
        if (invoiceData.orderTime) {
            doc.text(`Time: ${invoiceData.orderTime}`, R, y, { align: 'right' });
        }
        y += 4;
        if (invoiceData.customerName) {
            doc.text(`Guest: ${invoiceData.customerName}`, M, y);
            y += 4;
        }
        y += 2;
        drawDashedLine(doc, y);
        y += 4;
        setFont(doc, 'bold', 8);
        doc.text('QTY', M, y);
        doc.text('ITEM', M + 8, y);
        doc.text('AMOUNT', R, y, { align: 'right' });
        y += 2;
        drawDashedLine(doc, y);
        y += 4;
        setFont(doc, 'normal', 8);
        let totalQty = 0;
        invoiceData.items.forEach((item) => {
            totalQty += item.quantity;
            doc.text(`${item.quantity}`, M, y);
            const nameLines = doc.splitTextToSize(item.name, 45);
            doc.text(nameLines, M + 8, y);
            doc.text(`${item.total.toFixed(2)}`, R, y, { align: 'right' });
            y += (nameLines.length * 3.5) + 1;
            if (item.quantity > 1) {
                doc.setFontSize(7);
                doc.text(`@ ${item.price.toFixed(2)}`, M + 8, y);
                y += 3.5;
                doc.setFontSize(8);
            }
        });
        y += 1;
        drawDashedLine(doc, y);
        y += 4;
        setFont(doc, 'normal', 8);
        doc.text(`Total Items: ${totalQty}`, M, y);
        doc.text('Subtotal:', R - 20, y, { align: 'right' });
        doc.text(`${invoiceData.subtotal.toFixed(2)}`, R, y, { align: 'right' });
        y += 4;
        if (invoiceData.discount && invoiceData.discount > 0) {
            doc.text('Discount:', R - 20, y, { align: 'right' });
            doc.text(`-${invoiceData.discount.toFixed(2)}`, R, y, { align: 'right' });
            y += 4;
        }
        const taxLabel = invoiceData.taxPercent ? `GST (${invoiceData.taxPercent}%):` : 'GST:';
        doc.text(taxLabel, R - 20, y, { align: 'right' });
        doc.text(`${invoiceData.tax.toFixed(2)}`, R, y, { align: 'right' });
        y += 4;
        drawDashedLine(doc, y);
        y += 5;
        setFont(doc, 'bold', 10);
        doc.text('GRAND TOTAL:', R - 20, y, { align: 'right' });
        doc.text(`${invoiceData.total.toFixed(2)}`, R, y, { align: 'right' });
        y += 6;
        drawDashedLine(doc, y);
        y += 6;
        setFont(doc, 'normal', 7);
        if (invoiceData.fssaiNumber) {
            doc.text(`FSSAI: ${invoiceData.fssaiNumber}`, CX, y, { align: 'center' });
            y += 4;
        }
        const footerText = invoiceData.footerMessage || 'Thank you for dining with us!\nPlease visit again.';
        const footerLines = footerText.split('\n');
        footerLines.forEach(line => {
            doc.text(line, CX, y, { align: 'center' });
            y += 3.5;
        });
        y += 2;
        doc.text('Powered by DeQueue', CX, y, { align: 'center' });
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        logger_1.logger.info('Thermal PDF invoice generated successfully', {
            invoiceNumber: invoiceData.invoiceNumber,
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