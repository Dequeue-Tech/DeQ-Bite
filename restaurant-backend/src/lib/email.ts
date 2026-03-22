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

/**
 * Generate order confirmation email template
 */
export function generateOrderConfirmationEmailTemplate(orderData: {
  customerName: string;
  orderId: string;
  orderDate: string;
  items: Array<{ name: string; quantity: number }>;
  total: number;
  tableNumber: number;
  restaurantName: string;
  estimatedTime?: string;
}): string {
  const itemsList = orderData.items
    .map(item => `<tr><td>${item.name}</td><td>${item.quantity}</td></tr>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation</title>
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
          background-color: #d4edda;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          text-align: center;
        }
        .order-details {
          background-color: #fff;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .order-number {
          font-size: 24px;
          font-weight: bold;
          color: #28a745;
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
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .items-table th, .items-table td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #dee2e6;
        }
        .items-table th {
          background-color: #f8f9fa;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          color: #666;
          font-size: 14px;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }
        .estimated-time {
          background-color: #fff3cd;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: center;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>✅ Order Confirmed!</h1>
        <p>${orderData.restaurantName}</p>
      </div>
      
      <div class="order-details">
        <div class="order-number">Order #${orderData.orderId}</div>
        
        <div class="details-grid">
          <div class="detail-item">
            <div class="detail-label">Customer Name:</div>
            <div>${orderData.customerName}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Order Date:</div>
            <div>${orderData.orderDate}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Table Number:</div>
            <div>${orderData.tableNumber}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Status:</div>
            <div style="color: #28a745; font-weight: bold;">Confirmed</div>
          </div>
        </div>

        ${orderData.estimatedTime ? `
        <div class="estimated-time">
          ⏱️ Estimated Time: ${orderData.estimatedTime}
        </div>
        ` : ''}
        
        <h3>Order Summary:</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList}
          </tbody>
        </table>
        
        <div class="total-amount">
          Total Amount: ₹${orderData.total.toFixed(2)}
        </div>
        
        <p>Your order is being prepared. You will receive another notification when it's completed.</p>
      </div>
      
      <div class="footer">
        <p>This is an automated email. Please do not reply to this message.</p>
        <p>If you have any questions, please contact the restaurant directly.</p>
        <p>&copy; ${new Date().getFullYear()} ${orderData.restaurantName}. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate order completion email template
 */
export function generateOrderCompletionEmailTemplate(orderData: {
  customerName: string;
  orderId: string;
  orderDate: string;
  total: number;
  paymentMethod: string;
  restaurantName: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Completed</title>
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
          background-color: #cce5ff;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          text-align: center;
        }
        .order-details {
          background-color: #fff;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .order-number {
          font-size: 24px;
          font-weight: bold;
          color: #007bff;
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
        .payment-info {
          background-color: #d4edda;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: center;
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
          background-color: #007bff;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎉 Order Completed!</h1>
        <p>${orderData.restaurantName}</p>
      </div>
      
      <div class="order-details">
        <div class="order-number">Order #${orderData.orderId}</div>
        
        <div class="details-grid">
          <div class="detail-item">
            <div class="detail-label">Customer Name:</div>
            <div>${orderData.customerName}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Order Date:</div>
            <div>${orderData.orderDate}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Payment Method:</div>
            <div>${orderData.paymentMethod}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Status:</div>
            <div style="color: #007bff; font-weight: bold;">Completed</div>
          </div>
        </div>
        
        <div class="payment-info">
          ✅ Payment Successfully Processed
        </div>
        
        <div class="total-amount">
          Final Amount Paid: ₹${orderData.total.toFixed(2)}
        </div>
        
        <p>Thank you for dining with us! Your invoice is attached to this email for your records.</p>
      </div>
      
      <div class="footer">
        <p>This is an automated email. Please do not reply to this message.</p>
        <p>We hope to see you again soon!</p>
        <p>&copy; ${new Date().getFullYear()} ${orderData.restaurantName}. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send order confirmation email notification
 */
export async function sendOrderConfirmationEmail(
  email: string,
  orderData: {
    customerName: string;
    orderId: string;
    orderDate: string;
    items: Array<{ name: string; quantity: number }>;
    total: number;
    tableNumber: number;
    restaurantName: string;
    estimatedTime?: string;
  }
): Promise<boolean> {
  const subject = `Order #${orderData.orderId} Confirmed - ${orderData.restaurantName}`;
  const html = generateOrderConfirmationEmailTemplate(orderData);
  
  return await sendEmail({
    to: email,
    subject,
    html,
  });
}

/**
 * Send order completion email notification with invoice attachment
 */
export async function sendOrderCompletionEmail(
  email: string,
  orderData: {
    customerName: string;
    orderId: string;
    orderDate: string;
    total: number;
    paymentMethod: string;
    restaurantName: string;
  },
  pdfBuffer: Buffer
): Promise<boolean> {
  const subject = `Order #${orderData.orderId} Completed - ${orderData.restaurantName}`;
  const html = generateOrderCompletionEmailTemplate(orderData);
  
  return await sendEmail({
    to: email,
    subject,
    html,
    attachments: [
      {
        filename: `invoice-order-${orderData.orderId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}