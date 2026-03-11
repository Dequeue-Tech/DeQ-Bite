import jsPDF from 'jspdf';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '@/utils/logger';

export interface InvoiceData {
  fssaiNumber: string;
  cashierName: string;
  gstNumber: string;
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
 * Save PDF to secure storage
 */
export async function savePDFToStorage(
  pdfBuffer: Buffer,
  filename: string
): Promise<{ pdfPath: string | null; pdfData: Buffer | null; pdfName: string | null }> {
  try {
    const invoicesDir = path.join(process.cwd(), 'public', 'invoices');

    // Ensure directory exists
    await fs.mkdir(invoicesDir, { recursive: true });

    const filePath = path.join(invoicesDir, filename);

    // Save file (for public download support)
    await fs.writeFile(filePath, pdfBuffer);

    logger.info('PDF saved to storage', {
      filename,
      path: filePath,
    });

    return {
      pdfPath: `/invoices/${filename}`,
      pdfData: pdfBuffer,
      pdfName: filename,
    };
  } catch (error) {
    logger.error('Failed to save PDF to storage', {
      error: error instanceof Error ? error.message : 'Unknown error',
      filename,
    });

    throw new Error('Failed to save PDF invoice');
  }
}

/**
 * Clean up old invoice files (optional maintenance function)
 */
export async function cleanupOldInvoices(daysOld: number = 30): Promise<void> {
  try {
    const invoicesDir = path.join(process.cwd(), 'public', 'invoices');
    const files = await fs.readdir(invoicesDir);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(invoicesDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }
    
    logger.info('Old invoices cleaned up', {
      deletedCount,
      daysOld,
    });
  } catch (error) {
    logger.error('Failed to cleanup old invoices', {
      error: error instanceof Error ? error.message : 'Unknown error',
      daysOld,
    });
  }
}