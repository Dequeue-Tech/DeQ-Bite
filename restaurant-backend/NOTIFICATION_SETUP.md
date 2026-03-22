# Order Notification System - Setup Guide

## Overview

The Order Notification System automatically sends SMS and Email notifications to customers at key stages of their order lifecycle:

1. **Order Confirmation** - When order status changes from PENDING → CONFIRMED
2. **Order Completion** - When order is completed and payment is successfully processed

---

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database
- Backblaze B2 configured (for invoice PDF storage)
- SMTP email server or SendGrid/Mailgun account
- Fast2SMS account (or Twilio as alternative)

---

## 🔧 Configuration

### 1. Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

```bash
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Fast2SMS Configuration
FAST2SMS_API_KEY=your_fast2sms_api_key
FAST2SMS_SENDER_ID=FASTSM


# Backblaze B2 (Required for invoice PDFs)
B2_APPLICATION_KEY_ID=your_b2_application_key_id
B2_APPLICATION_KEY=your_b2_application_key
B2_BUCKET_ID=your_b2_bucket_id
B2_BUCKET_NAME=your-bucket-name
```

### 2. Fast2SMS Setup

#### Step 1: Create Account
1. Visit [Fast2SMS](https://www.fast2sms.com/)
2. Sign up for a free account
3. Complete KYC verification (required for India)

#### Step 2: Get API Key
1. Login to your Fast2SMS dashboard
2. Navigate to "Profile" or "API Keys" section
3. Copy your API key

#### Step 3: Configure Sender ID
- Default: `FASTSM`
- Custom: Register your brand name (requires approval)

#### Step 4: Update .env
```bash
FAST2SMS_API_KEY=abc123xyz456...
FAST2SMS_SENDER_ID=YOURBRAND
```

### 3. Email Setup (Gmail Example)

#### For Gmail Users:
1. Enable 2FA on your Google account
2. Generate an App Password:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the generated password
3. Use this password in `SMTP_PASS`

#### For SendGrid/Mailgun:
Update SMTP configuration:
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
```

---

## 🚀 Usage

### Automatic Triggers

Notifications are sent automatically when:

#### Order Confirmation
- **Trigger**: Order status changes from `PENDING` → `CONFIRMED`
- **Via**: `/api/orders/:id/status` endpoint
- **Content**:
  - ✅ Order confirmed message
  - 📋 Order ID and summary
  - 💰 Total amount
  - 🕐 Estimated delivery time (if available)

#### Order Completion
- **Trigger**: Order status changes to `COMPLETED` OR payment verified as COMPLETED
- **Via**: 
  - `/api/orders/:id/status` endpoint
  - `/api/payments/verify` endpoint
- **Content**:
  - 🎉 Thank you message
  - 📋 Order ID
  - ✅ Payment confirmation
  - 💵 Final amount paid
  - 📄 Invoice PDF attached to email

---

## 📝 API Examples

### 1. Update Order Status (Triggers Confirmation)

```bash
curl -X PUT http://localhost:5000/api/orders/{orderId}/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CONFIRMED"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": { ...order },
  "message": "Order status updated"
}
```

**Notification Behavior:**
- Email sent to customer with order details
- SMS sent to customer with order summary
- Failures are logged but don't block the response

### 2. Verify Payment (Triggers Completion)

```bash
curl -X POST http://localhost:5000/api/payments/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "razorpay_order_id": "order_abc123",
    "razorpay_payment_id": "pay_xyz789",
    "razorpay_signature": "signature..."
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "order": { ...updated_order },
    "paymentId": "pay_xyz789"
  }
}
```

**Notification Behavior:**
- Invoice PDF downloaded from B2 storage
- Email sent with invoice attached
- SMS sent with completion message
- Failures logged but don't block payment confirmation

---

## 🧪 Testing

### Manual Test Flow

1. **Setup Test Data**
   ```bash
   # Start the server
   npm run dev
   ```

2. **Create Test Order**
   ```bash
   curl -X POST http://localhost:5000/api/restaurants/{restaurantId}/orders \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "tableId": "table_id_here",
       "items": [{"menuItemId": "item_id", "quantity": 2}]
     }'
   ```

3. **Update to CONFIRMED Status**
   - Monitor logs for notification triggers
   - Check email inbox for confirmation email
   - Check phone for confirmation SMS

4. **Complete Payment**
   - Follow payment verification flow
   - Check email for completion notification with invoice PDF
   - Check phone for completion SMS

### Test Cases

✅ **Test Case 1**: Full notification (email + SMS)
- User has both email and phone
- Both channels should receive notifications

✅ **Test Case 2**: Email only
- User has only email (no phone)
- SMS should be skipped gracefully

✅ **Test Case 3**: SMS only
- User has only phone (no email)
- Email should be skipped gracefully

✅ **Test Case 4**: Missing invoice PDF
- Order completion without invoice
- Should log warning but continue with SMS

✅ **Test Case 5**: Fast2SMS failure
- Invalid API key or network error
- Should log error but not block order operations

---

## 📊 Logging & Monitoring

All notification events are logged:

### Success Logs
```
INFO: Order confirmation email sent
  orderId: "order_123"
  email: "customer@example.com"

INFO: Order confirmation SMS sent
  orderId: "order_123"
  phone: "+919876543210"
```

### Error Logs
```
ERROR: Failed to send order confirmation email
  orderId: "order_123"
  error: "SMTP connection failed"

ERROR: Fast2SMS API returned error
  orderId: "order_123"
  error: "Invalid API key"
  returnCode: "ERROR"
```

### Warning Logs
```
WARN: No email address available for order confirmation
  orderId: "order_123"

WARN: Invoice not found for order completion notification
  orderId: "order_123"
```

---

## 🔧 Troubleshooting

### Issue: Emails Not Sending

**Check:**
1. SMTP credentials in `.env`
2. Firewall blocking SMTP ports (587, 465)
3. Email provider rate limits
4. Spam folder for test emails

**Solution:**
```bash
# Test SMTP connection
telnet smtp.gmail.com 587

# Check logs
tail -f logs/combined.log | grep "email"
```

### Issue: SMS Not Sending

**Check:**
1. Fast2SMS API key validity
2. Sender ID approval status
3. Phone number format (include country code)
4. Fast2SMS account balance/credits

**Solution:**
```bash
# Test Fast2SMS API directly
curl -X POST https://www.fast2sms.com/dev/bulkV2 \
  -H "authorization: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "routing": "promotional",
    "sender_id": "FASTSM",
    "text": "Test message",
    "numbers": ["9876543210"]
  }'
```

### Issue: Invoice PDF Not Attached

**Check:**
1. B2 storage configuration
2. Invoice generation in `payments.ts`
3. PDF download permissions in B2 bucket

**Solution:**
```bash
# Check B2 configuration
node test-b2.mjs

# Verify invoice exists in database
npx prisma studio
# Browse to Invoice model
```

---

## 🏗️ Architecture

### Components

```
┌─────────────────────────────────────────────┐
│          Order Status Update                │
│         (via Orders Route)                  │
└──────────────┬──────────────────────────────┘
               │
               ├─► Status = CONFIRMED ──┐
               │                         ▼
               │            ┌────────────────────────┐
               │            │ sendOrderConfirmation  │
               │            │ Notification()         │
               │            └──────────┬─────────────┘
               │                       │
               │           ┌───────────┴──────────┐
               │           │                      │
               │           ▼                      ▼
               │  ┌────────────────┐  ┌────────────────┐
               │  │  Email Service │  │  SMS Service   │
               │  │  (SMTP/SendGrid)│  │  (Fast2SMS)    │
               │  └────────────────┘  └────────────────┘
               │
               └─► Status = COMPLETED ──┐
                                        ▼
                           ┌────────────────────────┐
                           │ sendOrderCompletion    │
                           │ Notification()         │
                           └──────────┬─────────────┘
                                      │
                          ┌───────────┴──────────┐
                          │                      │
                          ▼                      ▼
                 ┌────────────────┐  ┌────────────────┐
                 │  Email + PDF   │  │  SMS Service   │
                 │  Attachment    │  │  (Fast2SMS)    │
                 └────────────────┘  └────────────────┘
                        ▲
                        │
                  ┌─────┴──────┐
                  │ B2 Storage │
                  │  (PDF)     │
                  └────────────┘
```

### File Structure

```
restaurant-backend/src/
├── lib/
│   ├── email.ts           # Email service + templates
│   ├── fast2sms.ts        # Fast2SMS integration
│   ├── notification.ts    # Unified notification orchestration
│   └── pdf.ts             # PDF generation + B2 storage
├── routes/
│   ├── orders.ts          # Order status triggers
│   └── payments.ts        # Payment completion triggers
└── utils/
    └── logger.ts          # Logging utility
```

---

## 📈 Best Practices

### Production Deployment

1. **Use Background Jobs**
   - Move notifications to a job queue (Bull, Agenda)
   - Prevent blocking user responses
   - Enable retry logic

2. **Rate Limiting**
   - Implement exponential backoff for failed sends
   - Respect SMS/email provider rate limits

3. **Monitoring**
   - Set up alerts for high failure rates
   - Track delivery success metrics
   - Monitor B2 storage costs

4. **Security**
   - Never expose API keys in client code
   - Validate all user inputs
   - Use HTTPS for all external APIs

---

## 📞 Support

For issues or questions:
- Check logs in `logs/combined.log`
- Review Fast2SMS documentation: https://www.fast2sms.com/developers
- Review email provider documentation
- Check database for invoice records using Prisma Studio

---

## 🎉 Success Criteria

✅ Order confirmation emails sent successfully  
✅ Order confirmation SMS sent successfully  
✅ Order completion emails with invoice PDF sent successfully  
✅ Order completion SMS sent successfully  
✅ All failures logged gracefully  
✅ No blocking of core order/payment flows  

---

**Last Updated**: March 22, 2026  
**Version**: 1.0.0
