# Order Notification System - Quick Reference

## 🚀 Quick Start

### 1. Setup (5 minutes)

```bash
# Install axios dependency (if not already installed)
npm install axios

# Copy environment variables
cp .env.example .env

# Edit .env and add:
FAST2SMS_API_KEY=your_api_key_here
FAST2SMS_SENDER_ID=FASTSM
```

### 2. Get Fast2SMS API Key (2 minutes)

1. Visit https://www.fast2sms.com/
2. Sign up for free account
3. Go to Profile → API Keys
4. Copy your API key
5. Add to `.env`

### 3. Test It! (3 minutes)

```bash
# Start server
npm run dev

# In another terminal, create test order and trigger notifications:

# Step 1: Get auth token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "yourpassword"
  }'

# Save the token from response

# Step 2: Update order status to CONFIRMED (triggers confirmation notification)
curl -X PUT http://localhost:5000/api/orders/ORDER_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "CONFIRMED"}'

# Check your email and phone!
```

---

## 📋 API Endpoints

Notifications are **automatic** when you use these endpoints:

### Order Status Updates

#### Confirm Order
```http
PUT /api/orders/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "CONFIRMED"
}
```

**Triggers**: Order confirmation notification (email + SMS)

#### Complete Order
```http
PUT /api/orders/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "COMPLETED"
}
```

**Triggers**: Order completion notification with invoice PDF (email + SMS)

---

### Payment Verification

#### Verify Online Payment
```http
POST /api/payments/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "razorpay_order_id": "order_abc123",
  "razorpay_payment_id": "pay_xyz789",
  "razorpay_signature": "signature_here"
}
```

**Triggers**: If paymentStatus becomes COMPLETED → sends completion notification with invoice

#### Confirm Cash Payment
```http
POST /api/payments/cash/confirm
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "order_123",
  "amountPaise": 10000
}
```

**Triggers**: If paymentStatus becomes COMPLETED → sends completion notification with invoice

---

## 📧 Message Templates

### Order Confirmation Email

**Subject**: `Order #order_123 Confirmed - Restaurant Name`

**Content**:
- ✅ Green header with "Order Confirmed!"
- Order ID and details grid
- Table number
- Order summary table
- Total amount
- Estimated time (if available)
- Professional footer

### Order Completion Email

**Subject**: `Order #order_123 Completed - Restaurant Name`

**Content**:
- 🎉 Blue header with "Order Completed!"
- Order ID and details grid
- Payment method
- Payment success indicator
- Final amount paid
- Invoice PDF attached
- Thank you message

### Order Confirmation SMS

```
Dear John,

Your order #order_123 for ₹500.00 has been CONFIRMED 
for Table 5 at Haveli Dhaba.

Thank you for choosing us!

This is an automated message.
```

### Order Completion SMS

```
Dear John,

Your order #order_123 has been COMPLETED successfully.

Amount Paid: ₹500.00
Payment Method: RAZORPAY

Thank you for dining with Haveli Dhaba! 
We hope to see you again.

This is an automated message.
```

---

## 🔧 Configuration Quick Reference

### Environment Variables

```bash
# Required for notifications
FAST2SMS_API_KEY=abc123...          # Your Fast2SMS API key
FAST2SMS_SENDER_ID=FASTSM           # Sender ID (max 6 chars)

# Required for email
SMTP_HOST=smtp.gmail.com            # SMTP server
SMTP_PORT=587                       # SMTP port
SMTP_USER=you@gmail.com             # Your email
SMTP_PASS=app_password              # App-specific password

# Required for invoice PDFs
B2_APPLICATION_KEY_ID=...           # Backblaze key
B2_APPLICATION_KEY=...              # Backblaze secret
B2_BUCKET_ID=...                    # Bucket ID
B2_BUCKET_NAME=...                  # Bucket name
```

### Fast2SMS Sender ID Guidelines

- **Length**: Max 6 characters
- **Default**: `FASTSM`
- **Custom**: Can register your brand name (requires approval)
- **Examples**: `MYREST`, `FOODIE`, `QUICKBITE`

---

## 🧪 Testing Checklist

### Manual Test Scenarios

✅ **Test 1: Full Flow**
```bash
1. Create order (no notification yet)
2. Update status to CONFIRMED → Check email + SMS
3. Verify payment → Check email with invoice + SMS
```

✅ **Test 2: Email Only**
```bash
- User with email but no phone
- Should receive emails only
- SMS should be skipped gracefully
```

✅ **Test 3: SMS Only**
```bash
- User with phone but no email
- Should receive SMS only
- Email should be skipped gracefully
```

✅ **Test 4: Payment First**
```bash
- Verify payment before changing status
- Should trigger completion notification
- Invoice should be attached
```

✅ **Test 5: Status After Payment**
```bash
- Payment verified (COMPLETED)
- Then update status to COMPLETED
- Should NOT send duplicate notifications
```

---

## 🐛 Troubleshooting Quick Fixes

### No Emails Received

```bash
# Check SMTP connection
telnet smtp.gmail.com 587

# Test with curl
curl --verbose smtps://smtp.gmail.com:587

# Check logs
tail -f logs/combined.log | grep email
```

**Common Issues**:
- Wrong SMTP password (use app password, not regular password)
- Firewall blocking port 587
- Gmail 2FA not enabled

### No SMS Received

```bash
# Test Fast2SMS directly
curl -X POST https://www.fast2sms.com/dev/bulkV2 \
  -H "authorization: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "routing": "promotional",
    "sender_id": "FASTSM",
    "text": "Test",
    "numbers": ["9876543210"]
  }'

# Check logs
tail -f logs/combined.log | grep SMS
```

**Common Issues**:
- Invalid API key
- Phone number missing country code
- Insufficient balance in Fast2SMS account

### Invoice PDF Not Attached

```bash
# Check B2 configuration
node test-b2.mjs

# Verify invoice exists
npx prisma studio
# Browse to Invoice model
# Find invoice by orderId
```

**Common Issues**:
- B2 credentials incorrect
- Bucket permissions wrong
- Invoice not generated before payment completion

---

## 📊 Log Examples

### Success Logs

```
INFO [2026-03-22 10:30:15] Order confirmation email sent
  orderId: "order_abc123"
  email: "customer@example.com"

INFO [2026-03-22 10:30:16] Order confirmation SMS sent
  orderId: "order_abc123"
  phone: "+919876543210"

INFO [2026-03-22 10:30:20] Payment completion notification result
  orderId: "order_abc123"
  emailSent: true
  smsSent: true
```

### Error Logs

```
ERROR [2026-03-22 10:35:10] Failed to send order confirmation email
  orderId: "order_abc123"
  error: "SMTP connection timeout"

ERROR [2026-03-22 10:35:15] Fast2SMS API returned error
  orderId: "order_abc123"
  error: "Invalid API key"
  returnCode: "ERROR"
```

### Warning Logs

```
WARN [2026-03-22 10:40:20] No email address available for order confirmation
  orderId: "order_abc123"

WARN [2026-03-22 10:45:30] Invoice not found for order completion notification
  orderId: "order_abc123"
```

---

## 💡 Pro Tips

### 1. Development Mode

To test without actually sending:

```typescript
// Temporarily modify fast2sms.ts line 32
export async function sendFast2SMS(options: Fast2SMSOptions): Promise<boolean> {
  logger.info('DRY RUN - Would send SMS:', options);
  return true; // Always succeed
  
  // ... rest of code commented out
}
```

### 2. Batch Testing

Create a test script:

```javascript
// test-notifications.js
const orders = ['order_1', 'order_2', 'order_3'];

orders.forEach(async (orderId) => {
  await fetch(`/api/orders/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'CONFIRMED' })
  });
  
  console.log(`Notification triggered for ${orderId}`);
});
```

### 3. Monitoring Dashboard

Quick query for notification stats:

```sql
-- Count notifications by type (from logs)
grep "emailSent: true" logs/combined.log | wc -l
grep "smsSent: true" logs/combined.log | wc -l

-- Check database for invoice tracking
SELECT COUNT(*) FROM "Invoice" WHERE "emailSent" = true;
SELECT COUNT(*) FROM "Invoice" WHERE "smsSent" = true;
```

---

## 📈 Performance Notes

### Current Implementation

- **Synchronous**: PDF download blocks notification sending
- **Non-blocking**: Routes don't wait for notification completion
- **Fire-and-forget**: Notifications sent asynchronously
- **No retry**: Failed attempts not retried automatically

### Recommended for Production

1. **Background Jobs**: Move to Bull queue
2. **Retry Logic**: 3 attempts with exponential backoff
3. **Rate Limiting**: Respect provider limits
4. **Monitoring**: Set up alerts for failures

---

## 🎯 Success Metrics

Track these KPIs:

- **Email Delivery Rate**: Target > 95%
- **SMS Delivery Rate**: Target > 90%
- **Average Delivery Time**: Target < 5 seconds
- **Failure Rate**: Target < 2%

---

## 📞 Quick Links

- **Fast2SMS Dashboard**: https://www.fast2sms.com/dashboard
- **Fast2SMS API Docs**: https://www.fast2sms.com/developers
- **SendGrid SMTP**: https://docs.sendgrid.com/integrate/libraries/smtp
- **Mailgun SMTP**: https://documentation.mailgun.com/en/latest/user_manual.html#smtp-relay
- **Gmail App Passwords**: https://support.google.com/accounts/answer/185833

---

**Last Updated**: March 22, 2026  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
