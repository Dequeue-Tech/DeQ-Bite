"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.generateInvoiceEmailTemplate = generateInvoiceEmailTemplate;
exports.sendInvoiceEmail = sendInvoiceEmail;
exports.sendOrderCompletionEmail = sendOrderCompletionEmail;
exports.sendOrderConfirmationEmail = sendOrderConfirmationEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = require("@/utils/logger");
const getMissingEmailConfig = () => {
    const missing = [];
    if (!process.env.SMTP_HOST)
        missing.push("SMTP_HOST");
    if (!process.env.SMTP_PORT)
        missing.push("SMTP_PORT");
    if (!process.env.SMTP_USER)
        missing.push("SMTP_USER");
    if (!process.env.SMTP_PASS)
        missing.push("SMTP_PASS");
    return missing;
};
const createTransporter = () => {
    return nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_PORT === "465",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};
async function sendEmail(options) {
    const missingConfig = getMissingEmailConfig();
    if (missingConfig.length > 0) {
        logger_1.logger.error("Email configuration incomplete", { missingConfig });
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
        logger_1.logger.info("Email sent successfully", {
            to: options.to,
            subject: options.subject,
            messageId: result.messageId,
        });
        return true;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const gmailAuthHint = message.includes("535") ||
            message.toLowerCase().includes("username and password not accepted")
            ? "Gmail SMTP rejected login. Use a Gmail App Password (requires 2FA) instead of your normal account password."
            : undefined;
        logger_1.logger.error("Failed to send email", {
            error: message,
            ...(gmailAuthHint ? { hint: gmailAuthHint } : {}),
            to: options.to,
            subject: options.subject,
        });
        return false;
    }
}
function generateInvoiceEmailTemplate(invoiceData) {
    return `
    <!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Invoice ${invoiceData.invoiceNumber} — ${invoiceData.restaurantName}</title>

  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->

  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">

  <style>
    /* ── RESET ── */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; }
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background-color: #f4f1ec;
      color: #1a1a1a;
      -webkit-font-smoothing: antialiased;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }

    /* ── EMAIL CLIENT FIXES ── */
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td { padding: 0; }
    img { border: 0; outline: none; text-decoration: none; display: block; }
    a { text-decoration: none; }

    /* ── OUTER WRAPPER ── */
    .email-bg {
      background-color: #f4f1ec;
      padding: 32px 16px;
    }

    .email-wrapper {
      max-width: 620px;
      margin: 0 auto;
      width: 100%;
    }

    /* ── HEADER ── */
    .header {
      background: linear-gradient(135deg, #1a0a00 0%, #3d1a00 60%, #7c3500 100%);
      border-radius: 16px 16px 0 0;
      padding: 40px 40px 32px;
      position: relative;
      overflow: hidden;
    }

    .header-orb-1 {
      position: absolute; top: -40px; right: -40px;
      width: 200px; height: 200px; border-radius: 50%;
      background: rgba(234, 88, 12, 0.18); pointer-events: none;
    }
    .header-orb-2 {
      position: absolute; bottom: -60px; right: 60px;
      width: 140px; height: 140px; border-radius: 50%;
      background: rgba(234, 88, 12, 0.10); pointer-events: none;
    }

    .brand-row {
      display: flex; align-items: center;
      justify-content: space-between;
      margin-bottom: 28px; position: relative; z-index: 1;
    }

    .restaurant-name {
      font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
      font-size: 26px; font-weight: 700; color: #ffffff;
      letter-spacing: 0.3px; line-height: 1.2;
    }

    .bite-badge { display: flex; flex-direction: column; align-items: flex-end; }
    .bite-logo {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 18px; font-weight: 700; color: #ea580c; letter-spacing: 1px;
    }
    .bite-sub {
      font-size: 9px; color: rgba(255,255,255,0.45);
      letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px;
    }

    .header-divider {
      border: none; border-top: 1px solid rgba(255,255,255,0.12);
      margin-bottom: 24px; position: relative; z-index: 1;
    }

    .header-greeting { position: relative; z-index: 1; }
    .header-greeting h2 { font-size: 15px; font-weight: 600; color: #fde8d8; margin-bottom: 6px; }
    .header-greeting p { font-size: 13px; font-weight: 300; color: rgba(255,255,255,0.55); line-height: 1.6; }

    /* ── INVOICE CARD ── */
    .invoice-card {
      background: #ffffff;
      padding: 36px 40px;
      border-left: 1px solid #e8e0d5;
      border-right: 1px solid #e8e0d5;
    }

    .invoice-id-row {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 28px; padding-bottom: 20px;
      border-bottom: 1.5px dashed #e8e0d5;
    }

    .invoice-label {
      font-size: 10px; font-weight: 600; letter-spacing: 2px;
      text-transform: uppercase; color: #999; margin-bottom: 6px;
    }
    .invoice-number {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px; font-weight: 700; color: #ea580c; letter-spacing: 0.5px;
    }

    .status-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px;
      background: #f0fdf4; border: 1px solid #bbf7d0;
      border-radius: 100px;
      font-size: 12px; font-weight: 600; color: #16a34a; letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .status-dot {
      width: 7px; height: 7px;
      background: #22c55e; border-radius: 50%;
      display: inline-block; flex-shrink: 0;
    }

    /* ── DETAILS GRID ── */
    .details-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 0; margin-bottom: 28px;
      border: 1px solid #f0ebe3; border-radius: 10px; overflow: hidden;
    }
    .detail-cell { padding: 16px 20px; background: #faf8f5; }
    .detail-cell:nth-child(odd)  { border-right: 1px solid #f0ebe3; }
    .detail-cell:nth-child(1),
    .detail-cell:nth-child(2)   { border-bottom: 1px solid #f0ebe3; }
    .detail-cell-label {
      font-size: 10px; font-weight: 600; letter-spacing: 1.5px;
      text-transform: uppercase; color: #b0a899; margin-bottom: 5px;
    }
    .detail-cell-value { font-size: 14px; font-weight: 500; color: #1a1a1a; }

    /* ── TOTAL BOX ── */
    .total-box {
      background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
      border: 1.5px solid #fed7aa; border-radius: 12px;
      padding: 24px 28px; display: flex;
      align-items: center; justify-content: space-between;
      margin-bottom: 28px;
    }
    .total-title {
      font-size: 11px; font-weight: 600; letter-spacing: 1.8px;
      text-transform: uppercase; color: #c2610c; margin-bottom: 3px;
    }
    .total-note { font-size: 12px; color: #9a7b5f; font-weight: 300; }
    .total-amount {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px; font-weight: 700; color: #c2440c;
      letter-spacing: -0.5px; white-space: nowrap; margin-left: 16px;
    }
    .total-currency { font-size: 20px; }

    /* ── PDF NOTE ── */
    .pdf-note {
      display: flex; align-items: flex-start; gap: 12px;
      background: #f8faff; border: 1px solid #dbeafe;
      border-radius: 10px; padding: 16px 20px;
    }
    .pdf-icon { font-size: 22px; flex-shrink: 0; margin-top: 1px; }
    .pdf-note-text { font-size: 13px; color: #4b5563; line-height: 1.6; font-weight: 400; }
    .pdf-note-text strong { color: #1e40af; font-weight: 600; }

    /* ── FOOTER ── */
    .footer {
      background: #1a0a00; border-radius: 0 0 16px 16px;
      padding: 28px 40px; text-align: center;
    }
    .footer-brand {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; margin-bottom: 16px;
    }
    .footer-divider-line { width: 40px; height: 1px; background: rgba(255,255,255,0.15); }
    .footer-brand-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 13px; color: rgba(255,255,255,0.4); letter-spacing: 1px;
    }
    .footer-contact { font-size: 12px; color: rgba(255,255,255,0.35); margin-bottom: 16px; line-height: 1.7; }
    .footer-contact a { color: #ea580c; }
    .footer-powered {
      display: flex; align-items: center; justify-content: center;
      flex-wrap: wrap; gap: 4px;
      font-size: 10px; color: rgba(255,255,255,0.2);
      letter-spacing: 1px; text-transform: uppercase;
      border-top: 1px solid rgba(255,255,255,0.06);
      padding-top: 14px;
    }
    .powered-bite { color: #ea580c; opacity: 0.6; font-weight: 600; }
    .powered-dequeue { color: rgba(255,255,255,0.35); }

    /* ════════════════════════════════════
       RESPONSIVE — TABLET  ≤ 600px
    ════════════════════════════════════ */
    @media only screen and (max-width: 600px) {
      .email-bg { padding: 16px 10px; }

      .header { padding: 28px 24px 24px; border-radius: 12px 12px 0 0; }
      .brand-row { flex-direction: column; align-items: flex-start; gap: 12px; margin-bottom: 20px; }
      .bite-badge { align-items: flex-start; }
      .restaurant-name { font-size: 22px; }
      .header-greeting h2 { font-size: 14px; }
      .header-greeting p  { font-size: 12px; }

      .invoice-card { padding: 24px 24px; }

      .invoice-id-row {
        flex-direction: column; align-items: flex-start;
        gap: 12px; margin-bottom: 20px; padding-bottom: 16px;
      }
      .invoice-number { font-size: 20px; }

      /* 2-col → 1-col */
      .details-grid { grid-template-columns: 1fr; }
      .detail-cell:nth-child(odd)  { border-right: none; }
      .detail-cell:nth-child(1),
      .detail-cell:nth-child(2),
      .detail-cell:nth-child(3)   { border-bottom: 1px solid #f0ebe3; }

      .total-box { flex-direction: column; align-items: flex-start; gap: 10px; padding: 20px; }
      .total-amount { font-size: 26px; margin-left: 0; }

      .pdf-note { padding: 14px 16px; gap: 10px; }
      .pdf-note-text { font-size: 12px; }

      .footer { padding: 24px; border-radius: 0 0 12px 12px; }
      .footer-powered { font-size: 9px; }
    }

    /* ════════════════════════════════════
       RESPONSIVE — MOBILE  ≤ 400px
    ════════════════════════════════════ */
    @media only screen and (max-width: 400px) {
      .email-bg { padding: 12px 8px; }

      .header { padding: 22px 18px 20px; }
      .restaurant-name { font-size: 19px; }
      .bite-logo { font-size: 15px; }

      .invoice-card { padding: 20px 18px; }
      .invoice-number { font-size: 18px; }
      .status-pill { font-size: 11px; padding: 5px 11px; }
      .status-dot { width: 6px; height: 6px; }

      .detail-cell { padding: 13px 16px; }
      .detail-cell-label { font-size: 9px; }
      .detail-cell-value { font-size: 13px; }

      .total-box { padding: 16px; border-radius: 10px; }
      .total-title { font-size: 10px; }
      .total-note  { font-size: 11px; }
      .total-amount { font-size: 24px; }
      .total-currency { font-size: 16px; }

      .pdf-icon { font-size: 18px; }
      .pdf-note-text { font-size: 11.5px; }

      .footer { padding: 20px 18px; }
      .footer-contact { font-size: 11px; }
    }

    /* ════════════════════════════════════
       DARK MODE
    ════════════════════════════════════ */
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background-color: #1a1410 !important; }

      .invoice-card { background: #211a14 !important; border-color: #3a3028 !important; }
      .invoice-id-row { border-bottom-color: #3a3028 !important; }

      .details-grid { border-color: #3a3028 !important; }
      .detail-cell { background: #2a2018 !important; border-color: #3a3028 !important; }
      .detail-cell-label { color: #8a7a6a !important; }
      .detail-cell-value { color: #f0e8de !important; }

      .total-box {
        background: linear-gradient(135deg, #2a1a08 0%, #331e0a 100%) !important;
        border-color: #7c4010 !important;
      }
      .total-note { color: #b09070 !important; }

      .pdf-note { background: #16202e !important; border-color: #1e3a5f !important; }
      .pdf-note-text { color: #9fb3cc !important; }
      .pdf-note-text strong { color: #60a5fa !important; }
    }
  </style>
</head>
<body>
<div class="email-bg">
  <div class="email-wrapper">

    <!-- HEADER -->
    <div class="header">
      <div class="header-orb-1"></div>
      <div class="header-orb-2"></div>

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

      <div class="total-box">
        <div class="total-left">
          <div class="total-title">Amount Paid</div>
          <div class="total-note">Inclusive of all taxes &amp; charges</div>
        </div>
        <div class="total-amount">
          <span class="total-currency">₹</span>${invoiceData.total.toFixed(2)}
        </div>
      </div>

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
        For queries, reach us at <a href="mailto:info@dequeue.co.in">info@dequeue.co.in</a>
      </div>
      <div class="footer-powered">
        <span class="powered-dequeue">&copy; ${new Date().getFullYear()} ${invoiceData.restaurantName} &nbsp;·&nbsp; Powered by</span>
        <span class="powered-bite">#Bite</span>
        <span class="powered-dequeue">· Dequeue Retail Technologies Pvt. Ltd.</span>
      </div>
    </div>

  </div>
</div>
</body>
</html>`;
}
async function sendInvoiceEmail(email, invoiceData, pdfBuffer) {
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
                contentType: "application/pdf",
            },
        ],
    });
}
async function sendOrderCompletionEmail(input, pdfBuffer) {
    const orderCode = input.orderId.slice(0, 8).toUpperCase();
    const subject = `Invoice ${input.invoiceNumber} - Order #${orderCode}`;
    const html = generateInvoiceEmailTemplate({
        customerName: input.customerName,
        invoiceNumber: input.invoiceNumber,
        orderDate: input.orderDate || new Date().toLocaleDateString("en-IN"),
        total: input.totalInr,
        tableNumber: input.tableNumber ?? 0,
        restaurantName: input.restaurantName,
    });
    return await sendEmail({
        to: input.to,
        subject,
        html,
        attachments: [
            {
                filename: `invoice-${input.invoiceNumber}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
            },
        ],
    });
}
async function sendOrderConfirmationEmail(input) {
    const orderCode = input.orderId.slice(0, 8).toUpperCase();
    const subject = `Order #${orderCode} confirmed`;
    const html = `
    <div style="font-family: Arial, sans-serif; color: #222;">
      <h2>${input.restaurantName}</h2>
      <p>Hello ${input.customerName}, your order has been confirmed.</p>
      <p><strong>Order:</strong> #${orderCode}</p>
      <p>Your order is accepted and our team has started processing it.</p>
      <p>You can track live progress on your customer dashboard.</p>
    </div>
  `;
    return await sendEmail({
        to: input.to,
        subject,
        html,
    });
}
//# sourceMappingURL=email.js.map