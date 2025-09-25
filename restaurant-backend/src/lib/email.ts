import nodemailer from 'nodemailer';
import { logger } from '@/utils/logger';

// Email configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

/**
 * Send email with optional PDF attachment
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `${process.env.APP_NAME} <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    };
    
    const result = await transporter.sendMail(mailOptions);
    
    logger.info('Email sent successfully', {
      to: options.to,
      subject: options.subject,
      messageId: result.messageId,
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to send email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: options.to,
      subject: options.subject,
    });
    
    return false;
  }
}

/**
 * Generate invoice email template
 */
export function generateInvoiceEmailTemplate(invoiceData: {
  customerName: string;
  invoiceNumber: string;
  orderDate: string;
  total: number;
  tableNumber: number;
  restaurantName: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset=\"utf-8\">
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
      <title>Invoice ${invoiceData.invoiceNumber}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .invoice-details {
          background-color: #fff;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .invoice-number {
          font-size: 24px;
          font-weight: bold;
          color: #ea580c;
          margin-bottom: 10px;
        }
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 20px;
        }
        .detail-item {
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        .detail-label {
          font-weight: bold;
          color: #666;
        }
        .total-amount {
          font-size: 20px;
          font-weight: bold;
          color: #28a745;
          text-align: center;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 8px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          color: #666;
          font-size: 14px;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }
        .btn {
          display: inline-block;
          padding: 10px 20px;
          background-color: #ea580c;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class=\"header\">
        <h1>${invoiceData.restaurantName}</h1>
        <p>Thank you for dining with us!</p>
      </div>
      
      <div class=\"invoice-details\">
        <div class=\"invoice-number\">Invoice #${invoiceData.invoiceNumber}</div>
        
        <div class=\"details-grid\">
          <div class=\"detail-item\">
            <div class=\"detail-label\">Customer Name:</div>
            <div>${invoiceData.customerName}</div>
          </div>
          <div class=\"detail-item\">
            <div class=\"detail-label\">Order Date:</div>
            <div>${invoiceData.orderDate}</div>
          </div>
          <div class=\"detail-item\">
            <div class=\"detail-label\">Table Number:</div>
            <div>${invoiceData.tableNumber}</div>
          </div>
          <div class=\"detail-item\">
            <div class=\"detail-label\">Payment Status:</div>
            <div>Completed</div>
          </div>
        </div>
        
        <div class=\"total-amount\">
          Total Amount: ₹${invoiceData.total.toFixed(2)}
        </div>
        
        <p>Please find your detailed invoice attached as a PDF document.</p>
      </div>
      
      <div class=\"footer\">
        <p>This is an automated email. Please do not reply to this message.</p>
        <p>If you have any questions, please contact us at ${process.env.SMTP_USER}</p>
        <p>&copy; ${new Date().getFullYear()} ${invoiceData.restaurantName}. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send invoice notification email
 */
export async function sendInvoiceEmail(
  email: string,
  invoiceData: {
    customerName: string;
    invoiceNumber: string;
    orderDate: string;
    total: number;
    tableNumber: number;
    restaurantName: string;
  },
  pdfBuffer: Buffer
): Promise<boolean> {
  const subject = `Invoice ${invoiceData.invoiceNumber} - ${invoiceData.restaurantName}`;
  const html = generateInvoiceEmailTemplate(invoiceData);
  
  return await sendEmail({
    to: email,
    subject,
    html,
    attachments: [
      {
        filename: `invoice-${invoiceData.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}