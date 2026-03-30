import jsPDF from 'jspdf';
import { logger } from '@/utils/logger';
import { 
  uploadToB2, 
  downloadFromB2, 
  listFilesInB2, 
  deleteFromB2, 
  isB2Configured,
  getSignedDownloadUrl,
  isPrivateBucket as checkPrivateBucket,
} from './b2-storage';

// Re-export for use in routes
export const isPrivateBucket = checkPrivateBucket;

// ─── Thermal Receipt Constants ─────────────────────────────────────────────
const PAGE_W = 80; // Standard 80mm thermal paper width
const M = 4;       // Margins
const R = PAGE_W - M; // Right edge

// ─── Extended data shape ───────────────────────────────────────────────────
export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface InvoiceData {
  // Restaurant
  restaurantName: string;
  restaurantTagline?: string;
  restaurantAddress?: string;
  restaurantCity?: string;
  restaurantState?: string;
  restaurantPhone?: string;
  restaurantEmail?: string;
  gstNumber?: string;
  fssaiNumber?: string;

  // Customer
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  // Order
  orderDate: string;
  orderTime?: string;
  tableNumber?: string;
  cashierName?: string;
  invoiceNumber: string;
  paymentMode?: string;
  paymentMethod?: string;

  // Items & totals
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  taxPercent?: number;
  tax: number;
  total: number;
  amountPaid?: number;
  changeReturned?: number;

  // Footer
  footerMessage?: string;
}

// ─── Helper: Thermal Dashed Separator ──────────────────────────────────────
function drawDashedLine(doc: jsPDF, y: number): void {
  doc.setDrawColor(0, 0, 0); // Pure black
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(M, y, R, y);
  doc.setLineDashPattern([], 0); // Reset dash
}

// ─── Helper: Bold Text ─────────────────────────────────────────────────────
function setFont(doc: jsPDF, weight: 'normal' | 'bold', size: number) {
  doc.setFont('helvetica', weight);
  doc.setFontSize(size);
  doc.setTextColor(0, 0, 0); // Pure black
}

// ══════════════════════════════════════════════════════════════════════════════
export function generateInvoicePDF(invoiceData: InvoiceData): Buffer {
  try {
    // We dynamically calculate height later, but start with a standard long roll
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PAGE_W, 297] });
    const CX = PAGE_W / 2;
    let y = 8; // Starting top margin

    // ── HEADER (Center Aligned) ──────────────────────────────────────────────
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

    // ── BILL INFO (Left/Right Aligned) ───────────────────────────────────────
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

    // ── ITEMS HEADER ─────────────────────────────────────────────────────────
    setFont(doc, 'bold', 8);
    doc.text('QTY', M, y);
    doc.text('ITEM', M + 8, y);
    doc.text('AMOUNT', R, y, { align: 'right' });
    y += 2;
    drawDashedLine(doc, y);
    y += 4;

    // ── ITEMS LIST ───────────────────────────────────────────────────────────
    setFont(doc, 'normal', 8);
    let totalQty = 0;

    invoiceData.items.forEach((item) => {
      totalQty += item.quantity;

      // Qty
      doc.text(`${item.quantity}`, M, y);

      // Item Name (Wrapped)
      const nameLines = doc.splitTextToSize(item.name, 45);
      doc.text(nameLines, M + 8, y);

      // Amount
      doc.text(`${item.total.toFixed(2)}`, R, y, { align: 'right' });

      // If there are multiple lines for a long item name, push Y down further
      y += (nameLines.length * 3.5) + 1;
      
      // Optional: Add a line for the rate if quantity > 1 (e.g., "2 x 150.00")
      if (item.quantity > 1) {
        doc.setFontSize(7);
        doc.text(`@ ${item.price.toFixed(2)}`, M + 8, y);
        y += 3.5;
        doc.setFontSize(8); // reset
      }
    });

    y += 1;
    drawDashedLine(doc, y);
    y += 4;

    // ── TOTALS ───────────────────────────────────────────────────────────────
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

    // ── GRAND TOTAL ──────────────────────────────────────────────────────────
    setFont(doc, 'bold', 10);
    doc.text('GRAND TOTAL:', R - 20, y, { align: 'right' });
    doc.text(`${invoiceData.total.toFixed(2)}`, R, y, { align: 'right' });
    y += 6;

    drawDashedLine(doc, y);
    y += 6;

    // ── FOOTER ───────────────────────────────────────────────────────────────
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

    logger.info('Thermal PDF invoice generated successfully', {
      invoiceNumber: invoiceData.invoiceNumber,
      total: invoiceData.total,
    });

    return pdfBuffer;

  } catch (error) {
    logger.error('PDF generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      invoiceNumber: invoiceData.invoiceNumber,
    });
    throw new Error('Failed to generate PDF invoice');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// B2 CLOUD STORAGE INTEGRATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Save PDF to Backblaze B2 cloud storage
 */
export async function savePDFToStorage(
  pdfBuffer: Buffer,
  filename: string
): Promise<{ pdfPath: string | null; pdfData: Buffer | null; pdfName: string | null; b2FileId?: string }> {
  try {
    // Check if B2 is configured
    if (!isB2Configured()) {
      logger.error('Backblaze B2 is not configured');
      throw new Error('Cloud storage not configured');
    }

    // Upload to B2 with invoices/ prefix for organization
    const b2FileName = `invoices/${filename}`;
    const uploadResult = await uploadToB2(pdfBuffer, b2FileName, 'application/pdf');

    logger.info('PDF saved to B2 cloud storage', {
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
  } catch (error) {
    logger.error('Failed to save PDF to B2 storage', {
      error: error instanceof Error ? error.message : 'Unknown error',
      filename,
    });

    throw new Error('Failed to save PDF invoice to cloud storage');
  }
}

/**
 * Download PDF from Backblaze B2
 * @param fileName - The filename (with or without invoices/ prefix)
 * @returns Buffer containing the PDF data
 */
export async function downloadPDFFromStorage(fileName: string): Promise<Buffer> {
  try {
    // Ensure the filename has the invoices/ prefix
    const b2FileName = fileName.startsWith('invoices/') ? fileName : `invoices/${fileName}`;
    
    const pdfBuffer = await downloadFromB2(b2FileName);
    
    logger.info('PDF downloaded from B2 storage', {
      fileName: b2FileName,
      size: pdfBuffer.length,
    });

    return pdfBuffer;
  } catch (error) {
    logger.error('Failed to download PDF from B2 storage', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fileName,
    });
    throw new Error('Failed to download PDF from cloud storage');
  }
}

/**
 * Get download URL for a PDF (signed URL for private buckets, direct URL for public)
 * @param fileName - The filename of the PDF
 * @returns URL string for downloading the PDF
 */
export async function getPDFDownloadUrl(fileName: string): Promise<string> {
  try {
    const b2FileName = fileName.startsWith('invoices/') ? fileName : `invoices/${fileName}`;
    
    // For private buckets, generate a signed URL
    if (checkPrivateBucket()) {
      return await getSignedDownloadUrl(b2FileName, 3600); // 1 hour validity
    }
    
    // For public buckets, return the direct URL
    // This would need to be imported from b2-storage or reconstructed
    const bucketName = process.env['B2_BUCKET_NAME'];
    if (!bucketName) {
      throw new Error('B2_BUCKET_NAME not configured');
    }
    return `https://f000.backblazeb2.com/file/${bucketName}/${b2FileName}`;
  } catch (error) {
    logger.error('Failed to get PDF download URL', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fileName,
    });
    throw new Error('Failed to get PDF download URL');
  }
}

/**
 * Clean up old invoice files from B2 storage (optional maintenance function)
 * Note: B2 doesn't support automatic expiration, so we list files and delete old ones
 */
export async function cleanupOldInvoices(daysOld: number = 30): Promise<void> {
  try {
    if (!isB2Configured()) {
      logger.warn('B2 not configured, skipping cleanup');
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffTimestamp = cutoffDate.getTime();

    // List all invoice files in B2
    const files = await listFilesInB2('invoices/');
    
    let deletedCount = 0;
    
    for (const file of files) {
      // Check if file is older than cutoff
      if (file.uploadTimestamp < cutoffTimestamp) {
        await deleteFromB2(file.fileId, file.fileName);
        deletedCount++;
      }
    }
    
    logger.info('Old invoices cleaned up from B2', {
      deletedCount,
      daysOld,
      totalFiles: files.length,
    });
  } catch (error) {
    logger.error('Failed to cleanup old invoices from B2', {
      error: error instanceof Error ? error.message : 'Unknown error',
      daysOld,
    });
  }
}