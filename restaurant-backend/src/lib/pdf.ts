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

export interface LegacyInvoiceData {
  // Restaurant details — fetched from DB
  restaurantName: string;
  restaurantAddress?: string;
  restaurantCity?: string;
  restaurantState?: string;
  restaurantPhone?: string;
  restaurantEmail?: string;
  gstNumber?: string;
  fssaiNumber?: string;
  // Order details
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  invoiceNumber: string;
  orderDate: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  taxPercent?: number;   // e.g. 5 for "GST 5%"
  total: number;
  tableNumber: number;
  cashierName?: string;
  paymentMethod?: string;
}

/**
 * Generate PDF invoice from order data
 */

// Assuming logger and InvoiceData are defined in your file

// export function generateInvoicePDF(invoiceData: InvoiceData): Buffer {
//   try {
//     const doc = new jsPDF({
//       orientation: 'portrait',
//       unit: 'mm',
//       format: [80, 250]
//     });

//     const centerX = 40;
//     let currentY = 12;

//     // ----- HEADER -----
//     doc.setFont('helvetica', 'bold');
//     doc.setFontSize(14);
//     doc.text(invoiceData.restaurantName, centerX, currentY, { align: 'center' });

//     if (invoiceData.gstNumber) {
//       currentY += 5;
//       doc.setFont('helvetica', 'normal');
//       doc.setFontSize(8);
//       doc.text(`GST: ${invoiceData.gstNumber}`, centerX, currentY, { align: 'center' });
//     }

//     if (invoiceData.restaurantAddress) {
//       currentY += 4;
//       doc.setFontSize(8);
//       const addressLines = doc.splitTextToSize(invoiceData.restaurantAddress, 65);
//       doc.text(addressLines, centerX, currentY, { align: 'center' });
//       currentY += (addressLines.length - 1) * 4;
//     }

//     if (invoiceData.restaurantCity || invoiceData.restaurantState) {
//       currentY += 4;
//       const cityState = [invoiceData.restaurantCity, invoiceData.restaurantState]
//         .filter(Boolean)
//         .join(', ');
//       doc.text(cityState, centerX, currentY, { align: 'center' });
//     }

//     if (invoiceData.restaurantPhone) {
//       currentY += 4;
//       doc.text(`Ph: ${invoiceData.restaurantPhone}`, centerX, currentY, { align: 'center' });
//     }

//     currentY += 5;
//     doc.setLineWidth(0.3);
//     doc.line(5, currentY, 75, currentY);

//     // ----- CUSTOMER -----
//     currentY += 6;
//     doc.setFontSize(9);
//     doc.text(`Name: ${invoiceData.customerName || '-'}`, 5, currentY);

//     currentY += 4;
//     doc.line(5, currentY, 75, currentY);

//     // ----- BILL DETAILS -----
//     currentY += 6;
//     doc.text(`Date: ${invoiceData.orderDate}`, 5, currentY);

//     doc.setFont('helvetica', 'bold');
//     doc.text(`Dine In: ${invoiceData.tableNumber || '-'}`, 45, currentY);

//     currentY += 5;
//     doc.setFont('helvetica', 'normal');
//     doc.text(`Cashier: ${invoiceData.cashierName || '-'}`, 5, currentY);
//     doc.text(`Bill No: ${invoiceData.invoiceNumber}`, 45, currentY);

//     currentY += 4;
//     doc.line(5, currentY, 75, currentY);

//     // ----- ITEMS HEADER -----
//     currentY += 6;
//     doc.setFontSize(9);

//     doc.text('No', 5, currentY);
//     doc.text('Item', 12, currentY);
//     doc.text('Qty', 45, currentY);
//     doc.text('Price', 55, currentY);
//     doc.text('Amt', 75, currentY, { align: 'right' });

//     currentY += 2;
//     doc.line(5, currentY, 75, currentY);

//     // ----- ITEMS -----
//     currentY += 5;
//     let totalQty = 0;

//     invoiceData.items.forEach((item, index) => {
//       totalQty += item.quantity;

//       doc.text(`${index + 1}`, 5, currentY);

//       const itemNameLines = doc.splitTextToSize(item.name, 30);
//       doc.text(itemNameLines, 12, currentY);

//       doc.text(item.quantity.toString(), 45, currentY);
//       doc.text(item.price.toFixed(2), 55, currentY);
//       doc.text(item.total.toFixed(2), 75, currentY, { align: 'right' });

//       currentY += (itemNameLines.length * 5) + 3;
//     });

//     doc.line(5, currentY, 75, currentY);

//     // ----- TOTALS -----
//     currentY += 8;

//     doc.setFont('helvetica', 'normal');
//     doc.setFontSize(9);

//     doc.text(`Total Qty: ${totalQty}`, 5, currentY);
//     doc.text('Sub Total', 45, currentY);
//     doc.text(invoiceData.subtotal.toFixed(2), 75, currentY, { align: 'right' });

//     currentY += 8;

//     const taxLabel = invoiceData.taxPercent
//       ? `GST ${invoiceData.taxPercent}%`
//       : 'GST';

//     doc.text(taxLabel, 45, currentY);
//     doc.text(invoiceData.tax.toFixed(2), 75, currentY, { align: 'right' });

//     // separator above grand total
//     currentY += 7;
//     doc.setLineWidth(0.5);
//     doc.line(5, currentY, 75, currentY);

//     // ----- GRAND TOTAL -----
//     currentY += 9;

//     doc.setFont('helvetica', 'bold');
//     doc.setFontSize(11);

//     doc.text('Grand Total', 5, currentY);
//     doc.text(`INR ${invoiceData.total.toFixed(2)}`, 75, currentY, { align: 'right' });

//     currentY += 8;
//     doc.setLineWidth(0.5);
//     doc.line(5, currentY, 75, currentY);
//     currentY += 2;
//     doc.line(5, currentY, 75, currentY); // double line under grand total

//     // ----- FOOTER -----
//     if (invoiceData.fssaiNumber) {
//       currentY += 6;
//       doc.setFont('helvetica', 'bold');
//       doc.setFontSize(8);
//       doc.text(`FSSAI Lic No. ${invoiceData.fssaiNumber}`, centerX, currentY, {
//         align: 'center'
//       });
//     }

//     const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

//     logger.info('PDF invoice generated successfully', {
//       invoiceNumber: invoiceData.invoiceNumber,
//       customerName: invoiceData.customerName,
//       total: invoiceData.total
//     });

//     return pdfBuffer;

//   } catch (error) {
//     logger.error('PDF generation failed', {
//       error: error instanceof Error ? error.message : 'Unknown error',
//       invoiceNumber: invoiceData.invoiceNumber
//     });

//     throw new Error('Failed to generate PDF invoice');
//   }
// }

// ─── Color constants ───────────────────────────────────────────────────────
const COLOR_DARK   = '#1A1A2E';   // navy – header / grand-total band
const COLOR_ACCENT = '#E94560';   // red  – tagline rule, title bar, grand total amount
const COLOR_LIGHT  = '#F5F5F5';   // light gray – items-header background
const COLOR_MID    = '#AAAAAA';   // mid gray – labels, dividers

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

// ─── Helper: draw a filled rectangle ──────────────────────────────────────
function fillRect(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  hexColor: string
): void {
  doc.setFillColor(hexColor);
  doc.rect(x, y, w, h, 'F');
}

// ─── Helper: horizontal rule ───────────────────────────────────────────────
function hRule(
  doc: jsPDF,
  y: number,
  color: string,
  lineWidth = 0.4,
  x1 = 4, x2 = 76
): void {
  doc.setDrawColor(color);
  doc.setLineWidth(lineWidth);
  doc.line(x1, y, x2, y);
}

// ─── Helper: dotted rule ───────────────────────────────────────────────────
function dottedRule(doc: jsPDF, y: number, x1 = 4, x2 = 76): void {
  doc.setDrawColor(COLOR_MID);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([0.5, 1.5], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

// ─── Helper: two-column info row ───────────────────────────────────────────
function infoRow(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth = 18
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(COLOR_MID);
  doc.text(label, x, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR_DARK);
  doc.text(value, x + labelWidth, y);
}

// ─── Helper: totals row ────────────────────────────────────────────────────
function totalsRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  bold = false,
  valueColor = COLOR_DARK
): void {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(8);
  doc.setTextColor(bold ? COLOR_DARK : COLOR_MID);
  doc.text(label, 4, y);

  doc.setTextColor(valueColor);
  doc.text(value, 76, y, { align: 'right' });
}

// ══════════════════════════════════════════════════════════════════════════════
export function generateInvoicePDF(invoiceData: InvoiceData): Buffer {
  try {
    const PAGE_W = 80;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PAGE_W, 260] });

    const CX = PAGE_W / 2;   // center X
    const M  = 4;             // left/right margin
    const R  = PAGE_W - M;   // right edge
    const COL2 = PAGE_W / 2; // second column start

    let y = 0; // cursor (top-down from y=0 in jsPDF coords where origin is top-left)

    // ── HEADER BAND (dark navy) ──────────────────────────────────────────────
    const HEADER_H = 38;
    fillRect(doc, 0, 0, PAGE_W, HEADER_H, COLOR_DARK);

    // Restaurant name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor('#FFFFFF');
    doc.text(invoiceData.restaurantName.toUpperCase(), CX, 12, { align: 'center' });

    // Tagline
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(COLOR_ACCENT);
    doc.text(invoiceData.restaurantTagline || 'Fine Dining & Hospitality', CX, 16.5, { align: 'center' });

    // Thin accent rule
    doc.setDrawColor(COLOR_ACCENT);
    doc.setLineWidth(0.6);
    doc.line(10, 18.5, 70, 18.5);

    // Address / contact
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

    const contactParts: string[] = [];
    if (invoiceData.restaurantPhone) contactParts.push(`Ph: ${invoiceData.restaurantPhone}`);
    if (invoiceData.restaurantEmail) contactParts.push(invoiceData.restaurantEmail);
    if (contactParts.length) {
      doc.text(contactParts.join('  |  '), CX, addrY, { align: 'center' });
    }

    // GST
    if (invoiceData.gstNumber) {
      doc.setFontSize(6.5);
      doc.setTextColor('#999999');
      doc.text(`GSTIN: ${invoiceData.gstNumber}`, CX, 32.5, { align: 'center' });
    }

    y = HEADER_H;

    // ── INVOICE TITLE BAR (accent red) ───────────────────────────────────────
    fillRect(doc, 0, y, PAGE_W, 6, COLOR_ACCENT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor('#FFFFFF');
    doc.text('TAX INVOICE', CX, y + 4.2, { align: 'center' });
    y += 6;

    // ── CUSTOMER & BILL INFO ─────────────────────────────────────────────────
    y += 3;
    doc.setTextColor(COLOR_DARK);

    infoRow(doc, 'Customer:', invoiceData.customerName || '-', M, y);
    y += 4;
    infoRow(doc, 'Mobile:',   invoiceData.customerPhone || '-', M, y);
    y += 4;

    // Date + Time on same row
    infoRow(doc, 'Date:', invoiceData.orderDate, M, y);
    if (invoiceData.orderTime) {
      infoRow(doc, 'Time:', invoiceData.orderTime, COL2, y, 10);
    }
    y += 4;

    // Table + Cashier on same row
    infoRow(doc, 'Table:', invoiceData.tableNumber || '-', M, y);
    infoRow(doc, 'Cashier:', invoiceData.cashierName || '-', COL2, y, 12);
    y += 4;

    // Bill No + Payment mode on same row
    const shortBill = invoiceData.invoiceNumber.slice(-10);
    infoRow(doc, 'Bill No:', shortBill, M, y);
    if (invoiceData.paymentMode) {
      infoRow(doc, 'Mode:', invoiceData.paymentMode, COL2, y, 10);
    }
    y += 5;

    hRule(doc, y, COLOR_DARK, 0.8);
    y += 1;

    // ── ITEMS HEADER ─────────────────────────────────────────────────────────
    fillRect(doc, M, y, PAGE_W - 2 * M, 6.5, COLOR_LIGHT);
    y += 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(COLOR_DARK);
    doc.text('#',      M + 1,  y + 4);
    doc.text('ITEM',   M + 6,  y + 4);
    doc.text('QTY',    44,     y + 4);
    doc.text('PRICE',  53,     y + 4);
    doc.text('AMOUNT', R,      y + 4, { align: 'right' });
    y += 6.5;

    hRule(doc, y, COLOR_ACCENT, 0.6);
    y += 5.5;

    // ── ITEMS ────────────────────────────────────────────────────────────────
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

      doc.text(item.quantity.toString(),    44, y);
      doc.text(item.price.toFixed(2),       53, y);
      doc.text(item.total.toFixed(2),       R,  y, { align: 'right' });

      y += nameLines.length * 4.5;
      dottedRule(doc, y);
      y += 4;
    });

    hRule(doc, y, COLOR_DARK, 0.8);
    y += 6;

    // ── TOTALS ───────────────────────────────────────────────────────────────
    // Total qty + subtotal on same line
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

    // ── GRAND TOTAL BAND ─────────────────────────────────────────────────────
    fillRect(doc, 0, y - 2, PAGE_W, 10, COLOR_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor('#FFFFFF');
    doc.text('GRAND TOTAL', M + 2, y + 4.5);
    doc.setFontSize(11);
    doc.setTextColor(COLOR_ACCENT);
    doc.text(`INR ${invoiceData.total.toFixed(2)}`, R, y + 4.5, { align: 'right' });
    y += 12;

    // Amount paid / change
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

    // ── FSSAI ────────────────────────────────────────────────────────────────
    if (invoiceData.fssaiNumber) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(COLOR_MID);
      doc.text(`FSSAI Lic No.: ${invoiceData.fssaiNumber}`, CX, y, { align: 'center' });
      y += 5;
    }

    hRule(doc, y, COLOR_MID, 0.3);
    y += 6;

    // ── FOOTER MESSAGE ───────────────────────────────────────────────────────
    const footerLines = (invoiceData.footerMessage || 'Thank you for dining with us!\nWe hope to see you again soon.')
      .split('\n');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(COLOR_DARK);
    footerLines.forEach(line => {
      doc.text(line, CX, y, { align: 'center' });
      y += 4.5;
    });

    // Powered-by
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(COLOR_MID);
    doc.text('Powered by BillingPro v2.1', CX, y + 2, { align: 'center' });

    // ── OUTPUT ───────────────────────────────────────────────────────────────
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    logger.info('PDF invoice generated successfully', {
      invoiceNumber: invoiceData.invoiceNumber,
      customerName: invoiceData.customerName,
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
