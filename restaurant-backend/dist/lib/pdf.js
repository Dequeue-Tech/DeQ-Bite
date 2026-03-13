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
function generateInvoicePDF(invoiceData) {
    try {
        const doc = new jspdf_1.default({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, 250]
        });
        const centerX = 40;
        let currentY = 15;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(invoiceData.restaurantName, centerX, currentY, { align: 'center' });
        if (invoiceData.gstNumber) {
            currentY += 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(`GST: ${invoiceData.gstNumber}`, centerX, currentY, { align: 'center' });
        }
        if (invoiceData.restaurantAddress) {
            currentY += 4;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const addressLines = doc.splitTextToSize(invoiceData.restaurantAddress, 65);
            doc.text(addressLines, centerX, currentY, { align: 'center' });
            currentY += (addressLines.length - 1) * 4;
        }
        if (invoiceData.restaurantCity || invoiceData.restaurantState) {
            currentY += 4;
            const cityState = [invoiceData.restaurantCity, invoiceData.restaurantState]
                .filter(Boolean)
                .join(', ');
            doc.text(cityState, centerX, currentY, { align: 'center' });
        }
        if (invoiceData.restaurantPhone) {
            currentY += 4;
            doc.text(`Ph: ${invoiceData.restaurantPhone}`, centerX, currentY, { align: 'center' });
        }
        currentY += 4;
        doc.setLineWidth(0.5);
        doc.line(5, currentY, 75, currentY);
        currentY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Name: ${invoiceData.customerName || ''}`, 5, currentY);
        currentY += 3;
        doc.line(5, currentY, 75, currentY);
        currentY += 5;
        doc.text(`Date: ${invoiceData.orderDate}`, 5, currentY);
        doc.setFont('helvetica', 'bold');
        doc.text(`Dine In: ${invoiceData.tableNumber || '4'}`, 45, currentY);
        currentY += 4;
        doc.setFont('helvetica', 'normal');
        doc.text(`Cashier: ${invoiceData.cashierName || '-'}`, 5, currentY);
        doc.text(`Bill No.: ${invoiceData.invoiceNumber}`, 45, currentY);
        currentY += 4;
        doc.line(5, currentY, 75, currentY);
        currentY += 5;
        doc.text('No.', 5, currentY);
        doc.text('Item', 12, currentY);
        doc.text('Qty.', 45, currentY);
        doc.text('Price', 55, currentY);
        doc.text('Amount', 75, currentY, { align: 'right' });
        currentY += 2;
        doc.line(5, currentY, 75, currentY);
        currentY += 5;
        let totalQty = 0;
        invoiceData.items.forEach((item, index) => {
            totalQty += item.quantity;
            doc.text(`${index + 1}`, 5, currentY);
            const itemNameLines = doc.splitTextToSize(item.name, 30);
            doc.text(itemNameLines, 12, currentY);
            doc.text(item.quantity.toString(), 45, currentY);
            doc.text(item.price.toFixed(2), 55, currentY);
            doc.text(item.total.toFixed(2), 75, currentY, { align: 'right' });
            currentY += (itemNameLines.length * 4) + 1;
        });
        doc.line(5, currentY, 75, currentY);
        currentY += 5;
        doc.text(`Total Qty: ${totalQty}`, 12, currentY);
        doc.text('Sub Total', 45, currentY);
        doc.text(invoiceData.subtotal.toFixed(2), 75, currentY, { align: 'right' });
        currentY += 4;
        const taxLabel = invoiceData.taxPercent ? `GST ${invoiceData.taxPercent}%` : 'GST';
        doc.text(taxLabel, 45, currentY);
        doc.text(invoiceData.tax.toFixed(2), 75, currentY, { align: 'right' });
        currentY += 3;
        doc.line(5, currentY, 75, currentY);
        currentY += 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Grand Total', 40, currentY);
        doc.text(`INR ${invoiceData.total.toFixed(2)}`, 75, currentY, { align: 'right' });
        currentY += 3;
        doc.line(5, currentY, 75, currentY);
        if (invoiceData.fssaiNumber) {
            currentY += 5;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text(`FSSAI Lic No. ${invoiceData.fssaiNumber}`, centerX, currentY, { align: 'center' });
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