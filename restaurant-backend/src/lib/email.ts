import nodemailer from 'nodemailer';
import { logger } from '@/utils/logger';

const getMissingEmailConfig = () => {
  const missing: string[] = [];
  if (!process.env.SMTP_HOST) missing.push('SMTP_HOST');
  if (!process.env.SMTP_PORT) missing.push('SMTP_PORT');
  if (!process.env.SMTP_USER) missing.push('SMTP_USER');
  if (!process.env.SMTP_PASS) missing.push('SMTP_PASS');
  return missing;
};

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
  const missingConfig = getMissingEmailConfig();
  if (missingConfig.length > 0) {
    logger.error('Email configuration incomplete', { missingConfig });
    return false;
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();

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
    const message = error instanceof Error ? error.message : 'Unknown error';
    const gmailAuthHint =
      message.includes('535') || message.toLowerCase().includes('username and password not accepted')
        ? 'Gmail SMTP rejected login. Use a Gmail App Password (requires 2FA) instead of your normal account password.'
        : undefined;

    logger.error('Failed to send email', {
      error: message,
      ...(gmailAuthHint ? { hint: gmailAuthHint } : {}),
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
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoiceData.invoiceNumber} — ${invoiceData.restaurantName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'DM Sans', Arial, sans-serif;
          background-color: #f4f1ec;
          color: #1a1a1a;
          padding: 32px 16px;
          -webkit-font-smoothing: antialiased;
        }

        .email-wrapper {
          max-width: 620px;
          margin: 0 auto;
        }

        /* ── HEADER ── */
        .header {
          background: linear-gradient(135deg, #1a0a00 0%, #3d1a00 60%, #7c3500 100%);
          border-radius: 16px 16px 0 0;
          padding: 40px 40px 32px;
          position: relative;
          overflow: hidden;
        }

        .header::before {
          content: '';
          position: absolute;
          top: -40px;
          right: -40px;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: rgba(234, 88, 12, 0.18);
        }

        .header::after {
          content: '';
          position: absolute;
          bottom: -60px;
          right: 60px;
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background: rgba(234, 88, 12, 0.1);
        }

        .brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
          position: relative;
          z-index: 1;
        }

        .restaurant-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 26px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.3px;
          line-height: 1.2;
        }

        .bite-badge {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .bite-logo {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 18px;
          font-weight: 700;
          color: #ea580c;
          letter-spacing: 1px;
        }

        .bite-sub {
          font-size: 9px;
          color: rgba(255,255,255,0.45);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-top: 2px;
        }

        .header-divider {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.12);
          margin-bottom: 24px;
          position: relative;
          z-index: 1;
        }

        .header-greeting {
          position: relative;
          z-index: 1;
        }

        .header-greeting h2 {
          font-size: 15px;
          font-weight: 600;
          color: #fde8d8;
          margin-bottom: 6px;
        }

        .header-greeting p {
          font-size: 13px;
          font-weight: 300;
          color: rgba(255,255,255,0.55);
          line-height: 1.6;
        }

        /* ── INVOICE CARD ── */
        .invoice-card {
          background: #ffffff;
          padding: 36px 40px;
          border-left: 1px solid #e8e0d5;
          border-right: 1px solid #e8e0d5;
        }

        .invoice-id-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
          padding-bottom: 20px;
          border-bottom: 1.5px dashed #e8e0d5;
        }

        .invoice-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #999;
          margin-bottom: 6px;
        }

        .invoice-number {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 22px;
          font-weight: 700;
          color: #ea580c;
          letter-spacing: 0.5px;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          color: #16a34a;
          letter-spacing: 0.3px;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          background: #22c55e;
          border-radius: 50%;
        }

        /* ── DETAILS GRID ── */
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          margin-bottom: 28px;
          border: 1px solid #f0ebe3;
          border-radius: 10px;
          overflow: hidden;
        }

        .detail-cell {
          padding: 16px 20px;
          background: #faf8f5;
        }

        .detail-cell:nth-child(odd) {
          border-right: 1px solid #f0ebe3;
        }

        .detail-cell:nth-child(1),
        .detail-cell:nth-child(2) {
          border-bottom: 1px solid #f0ebe3;
        }

        .detail-cell-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #b0a899;
          margin-bottom: 5px;
        }

        .detail-cell-value {
          font-size: 14px;
          font-weight: 500;
          color: #1a1a1a;
        }

        /* ── TOTAL BOX ── */
        .total-box {
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          border: 1.5px solid #fed7aa;
          border-radius: 12px;
          padding: 24px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
        }

        .total-left {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .total-title {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: #c2610c;
        }

        .total-note {
          font-size: 12px;
          color: #9a7b5f;
          font-weight: 300;
        }

        .total-amount {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 32px;
          font-weight: 700;
          color: #c2440c;
          letter-spacing: -0.5px;
        }

        .total-currency {
          font-size: 20px;
        }

        /* ── PDF NOTE ── */
        .pdf-note {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: #f8faff;
          border: 1px solid #dbeafe;
          border-radius: 10px;
          padding: 16px 20px;
        }

        .pdf-icon {
          font-size: 22px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .pdf-note-text {
          font-size: 13px;
          color: #4b5563;
          line-height: 1.6;
          font-weight: 400;
        }

        .pdf-note-text strong {
          color: #1e40af;
          font-weight: 600;
        }

        /* ── FOOTER ── */
        .footer {
          background: #1a0a00;
          border-radius: 0 0 16px 16px;
          padding: 28px 40px;
          text-align: center;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .footer-divider-line {
          width: 40px;
          height: 1px;
          background: rgba(255,255,255,0.15);
        }

        .footer-brand-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          letter-spacing: 1px;
        }

        .footer-contact {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          margin-bottom: 16px;
          line-height: 1.7;
        }

        .footer-contact a {
          color: #ea580c;
          text-decoration: none;
        }

        .footer-powered {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          color: rgba(255,255,255,0.2);
          letter-spacing: 1px;
          text-transform: uppercase;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 14px;
          width: 100%;
          justify-content: center;
        }

        .powered-bite {
          color: #ea580c;
          opacity: 0.6;
          font-weight: 600;
        }

        .powered-dequeue {
          color: rgba(255,255,255,0.35);
        }

        @media (max-width: 480px) {
          .header, .invoice-card, .footer {
            padding-left: 24px;
            padding-right: 24px;
          }
          .brand-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .bite-badge {
            align-items: flex-start;
          }
          .invoice-id-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .details-grid {
            grid-template-columns: 1fr;
          }
          .detail-cell:nth-child(odd) {
            border-right: none;
          }
          .detail-cell:nth-child(1),
          .detail-cell:nth-child(2) {
            border-bottom: 1px solid #f0ebe3;
          }
          .detail-cell:nth-child(3) {
            border-bottom: 1px solid #f0ebe3;
          }
          .total-box {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          .restaurant-name {
            font-size: 21px;
          }
          .total-amount {
            font-size: 26px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">

        <!-- HEADER -->
        <div class="header">
          <div class="brand-row">
            <div class="restaurant-name">${invoiceData.restaurantName}</div>
            <div class="bite-badge">
              <div class="bite-logo">#Bite</div>
              <div class="bite-sub">by Dequeue</div>
            </div>
          </div>
          <hr class="header-divider">
          <div class="header-greeting">
            <h2>Thank you, ${invoiceData.customerName}!</h2>
            <p>We hope you enjoyed your experience. Here's a summary of your visit — your detailed invoice is attached below.</p>
          </div>
        </div>

        <!-- INVOICE CARD -->
        <div class="invoice-card">

          <!-- Invoice ID + Status -->
          <div class="invoice-id-row">
            <div>
              <div class="invoice-label">Invoice</div>
              <div class="invoice-number">#${invoiceData.invoiceNumber}</div>
            </div>
            <div class="status-pill">
              <span class="status-dot"></span>
              Payment Completed
            </div>
          </div>

          <!-- Details Grid -->
          <div class="details-grid">
            <div class="detail-cell">
              <div class="detail-cell-label">Guest Name</div>
              <div class="detail-cell-value">${invoiceData.customerName}</div>
            </div>
            <div class="detail-cell">
              <div class="detail-cell-label">Order Date</div>
              <div class="detail-cell-value">${invoiceData.orderDate}</div>
            </div>
            <div class="detail-cell">
              <div class="detail-cell-label">Table Number</div>
              <div class="detail-cell-value">${invoiceData.tableNumber}</div>
            </div>
            <div class="detail-cell">
              <div class="detail-cell-label">Invoice Number</div>
              <div class="detail-cell-value">#${invoiceData.invoiceNumber}</div>
            </div>
          </div>

          <!-- Total -->
          <div class="total-box">
            <div class="total-left">
              <div class="total-title">Amount Paid</div>
              <div class="total-note">Inclusive of all taxes &amp; charges</div>
            </div>
            <div class="total-amount">
              <span class="total-currency">₹</span>${invoiceData.total.toFixed(2)}
            </div>
          </div>

          <!-- PDF Note -->
          <div class="pdf-note">
            <div class="pdf-icon">📎</div>
            <div class="pdf-note-text">
              Your <strong>detailed invoice PDF</strong> is attached to this email. It includes a full itemised breakdown of your order. Please save it for your records.
            </div>
          </div>

        </div>

        <!-- FOOTER -->
        <div class="footer">
          <div class="footer-brand">
            <div class="footer-divider-line"></div>
            <div class="footer-brand-name">${invoiceData.restaurantName}</div>
            <div class="footer-divider-line"></div>
          </div>
          <div class="footer-contact">
            This is an automated message — please do not reply directly.<br>
            For queries, reach us at <a href="mailto:${process.env.SMTP_USER}">${process.env.SMTP_USER}</a>
          </div>
          <div class="footer-powered">
            <span class="powered-dequeue">&copy; ${new Date().getFullYear()} ${invoiceData.restaurantName} &nbsp;·&nbsp; Powered by</span>
            <span class="powered-bite">#Bite</span>
            <span class="powered-dequeue">· Dequeue Retail Technologies Pvt. Ltd.</span>
          </div>
        </div>

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



