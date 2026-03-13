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

export interface InvoiceData {
  fssaiNumber?: string;
  cashierName?: string;
  gstNumber?: string;
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
  total: number;
  tableNumber: number;
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  paymentMethod?: string;
}

/**
 * Generate PDF invoice from order data
 */

// Assuming logger and InvoiceData are defined in your file

export function generateInvoicePDF(invoiceData: InvoiceData): Buffer {
  try {
    // Set format to 80mm width (Standard POS Receipt Roll) 
    // Height is set to 250mm but can be adjusted based on item count
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 250] 
    });
    
    const centerX = 40; // Center of an 80mm page
    let currentY = 15;
    
    // --- Header ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Restaurant', centerX, currentY, { align: 'center' });
    
    currentY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Food & Drinks', centerX, currentY, { align: 'center' });
    
    currentY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(invoiceData.restaurantName || 'ABC CAFE & RESTRO', centerX, currentY, { align: 'center' });
    
    currentY += 4;
    doc.text(invoiceData.gstNumber || '08AAKXX7086X1ZT', centerX, currentY, { align: 'center' });
    
    currentY += 5;
    doc.text('BLOCK D PLOT NO 103', centerX, currentY, { align: 'center' });
    currentY += 4;
    doc.text('NEW DELHI-110009', centerX, currentY, { align: 'center' });
    
    // --- Divider ---
    currentY += 4;
    doc.setLineWidth(0.5);
    doc.line(5, currentY, 75, currentY);
    
    // --- Customer Details ---
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Name: ${invoiceData.customerName || ''}`, 5, currentY);
    
    currentY += 3;
    doc.line(5, currentY, 75, currentY);
    
    // --- Bill Details ---
    currentY += 5;
    doc.text(`Date: ${invoiceData.orderDate}`, 5, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(`Dine In: ${invoiceData.tableNumber || '4'}`, 45, currentY);
    
    currentY += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`Cashier: ${invoiceData.cashierName || 'biller'}`, 5, currentY);
    doc.text(`Bill No.: ${invoiceData.invoiceNumber}`, 45, currentY);
    
    currentY += 4;
    doc.line(5, currentY, 75, currentY);
    
    // --- Items Header ---
    currentY += 5;
    doc.text('No.', 5, currentY);
    doc.text('Item', 12, currentY);
    doc.text('Qty.', 45, currentY);
    doc.text('Price', 55, currentY);
    doc.text('Amount', 75, currentY, { align: 'right' });
    
    currentY += 2;
    doc.line(5, currentY, 75, currentY);
    
    // --- Items List ---
    currentY += 5;
    let totalQty = 0;
    
    invoiceData.items.forEach((item, index) => {
      totalQty += item.quantity;
      
      // Serial Number
      doc.text(`${index + 1}`, 5, currentY);
      
      // Wrap long item names inside a 30mm width block
      const itemNameLines = doc.splitTextToSize(item.name, 30);
      doc.text(itemNameLines, 12, currentY);
      
      // Quantities and Prices
      doc.text(item.quantity.toString(), 45, currentY);
      doc.text(item.price.toFixed(2), 55, currentY);
      doc.text(item.total.toFixed(2), 75, currentY, { align: 'right' });
      
      // Shift Y down based on the number of lines the item name took
      currentY += (itemNameLines.length * 4) + 1; 
    });
    
    doc.line(5, currentY, 75, currentY);
    
    // --- Totals Section ---
    currentY += 5;
    doc.text(`Total Qty: ${totalQty}`, 12, currentY);
    doc.text('Sub Total', 45, currentY);
    doc.text(invoiceData.subtotal.toFixed(2), 75, currentY, { align: 'right' });
    
    currentY += 4;
    // Assuming GST is 5% in your data
    doc.text('GST 5%', 45, currentY);
    doc.text(invoiceData.tax.toFixed(2), 75, currentY, { align: 'right' });
    
    currentY += 3;
    doc.line(5, currentY, 75, currentY);
    
    // --- Grand Total ---
    currentY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Grand Total', 40, currentY);
    // Note: jsPDF standard fonts don't natively support the ₹ symbol well without importing a custom TTF font.
    // Use 'INR' or 'Rs' if the ₹ renders as a question mark.
    doc.text(`INR ${invoiceData.total.toFixed(2)}`, 75, currentY, { align: 'right' }); 
    
    currentY += 3;
    doc.line(5, currentY, 75, currentY);
    
    // --- Footer ---
    currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`FSSAI Lic No. ${invoiceData.fssaiNumber || '13364267896567'}`, centerX, currentY, { align: 'center' });
    
    // Generate buffer
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