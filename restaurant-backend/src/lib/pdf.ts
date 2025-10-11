import jsPDF from 'jspdf';
import { logger } from '@/utils/logger';

export interface InvoiceData {
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
export function generateInvoicePDF(invoiceData: InvoiceData): Buffer {
  try {
    const doc = new jsPDF();
    
    // Set font
    doc.setFont('helvetica');
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text(invoiceData.restaurantName || 'Restaurant', 20, 25);
    
    // Invoice title
    doc.setFontSize(16);
    doc.text('INVOICE', 20, 40);
    
    // Invoice details (right side)
    doc.setFontSize(10);
    doc.text(`Invoice #: ${invoiceData.invoiceNumber}`, 140, 25);
    doc.text(`Date: ${invoiceData.orderDate}`, 140, 35);
    doc.text(`Table: ${invoiceData.tableNumber}`, 140, 45);
    
    // Customer details
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
    
    // Table header
    const startY = 110;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Item', 20, startY);
    doc.text('Qty', 120, startY);
    doc.text('Price', 140, startY);
    doc.text('Total', 170, startY);
    
    // Draw line under header
    doc.line(20, startY + 5, 190, startY + 5);
    
    // Table rows
    doc.setFont('helvetica', 'normal');
    let currentY = startY + 15;
    
    invoiceData.items.forEach((item) => {
      doc.text(item.name, 20, currentY);
      doc.text(item.quantity.toString(), 120, currentY);
      doc.text(`₹${item.price.toFixed(2)}`, 140, currentY);
      doc.text(`₹${item.total.toFixed(2)}`, 170, currentY);
      currentY += 10;
    });
    
    // Draw line before totals
    currentY += 5;
    doc.line(20, currentY, 190, currentY);
    
    // Totals
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
    
    // Payment method
    if (invoiceData.paymentMethod) {
      currentY += 20;
      doc.setFont('helvetica', 'normal');
      doc.text(`Payment Method: ${invoiceData.paymentMethod}`, 20, currentY);
    }
    
    // Footer
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
 * Save PDF to database storage
 */
export async function savePDFToStorage(
  pdfBuffer: Buffer,
  filename: string
): Promise<{ pdfPath: string | null; pdfData: Buffer | null; pdfName: string | null }> {
  try {
    // In database storage, we don't need a file path
    // Instead, we return the PDF data and filename to be stored in the database
    
    logger.info('PDF prepared for database storage', {
      filename,
      size: pdfBuffer.length,
    });
    
    return {
      pdfPath: null, // No file path needed
      pdfData: pdfBuffer, // PDF data to store in database
      pdfName: filename, // Filename for reference
    };
  } catch (error) {
    logger.error('Failed to prepare PDF for database storage', {
      error: error instanceof Error ? error.message : 'Unknown error',
      filename,
    });
    
    throw new Error('Failed to prepare PDF for database storage');
  }
}

/**
 * Clean up old invoice files (deprecated - no longer needed with database storage)
 */
export async function cleanupOldInvoices(_daysOld: number = 30): Promise<void> {
  // This function is no longer needed with database storage
  // Using _daysOld to avoid unused parameter error
  logger.info('cleanupOldInvoices function is deprecated with database storage');
}