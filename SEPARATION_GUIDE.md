# Restaurant Application - Backend & Frontend Separation

This document outlines the complete separation of the restaurant application into secure, scalable backend and frontend services.

## 🏗️ Architecture Overview

The application has been successfully separated into:
- **Backend API Server**: Express.js + TypeScript + Prisma + PostgreSQL
- **Frontend Application**: Next.js + React + TypeScript + Tailwind CSS

### 🔒 Security Features Implemented

#### Payment Security
- **Razorpay Integration**: Secure payment gateway with signature verification
- **Server-side Verification**: All payment signatures verified on backend
- **Token-based Authentication**: JWT tokens for API access
- **Rate Limiting**: Protection against brute force attacks
- **CORS Protection**: Controlled cross-origin requests
- **Input Validation**: Zod schemas for all API endpoints

#### Invoice Security
- **Post-payment Generation**: Invoices only generated after successful payment verification
- **Secure File Storage**: PDFs stored in controlled directories
- **Email/SMS Delivery**: Multi-channel invoice delivery
- **Access Control**: Users can only access their own invoices

## 📁 Project Structure

```
Restaurant/
├── restaurant-backend/          # Express.js API Server
│   ├── src/
│   │   ├── routes/             # API route handlers
│   │   │   ├── auth.ts         # Authentication endpoints
│   │   │   ├── payments.ts     # Secure payment processing
│   │   │   ├── invoices.ts     # Invoice generation & delivery
│   │   │   └── ...
│   │   ├── lib/                # Business logic
│   │   │   ├── razorpay.ts     # Payment gateway integration
│   │   │   ├── pdf.ts          # PDF generation
│   │   │   ├── email.ts        # Email service
│   │   │   └── sms.ts          # SMS service
│   │   ├── middleware/         # Express middleware
│   │   │   ├── auth.ts         # JWT authentication
│   │   │   └── errorHandler.ts # Error handling
│   │   ├── config/             # Configuration
│   │   │   └── database.ts     # Prisma connection
│   │   ├── types/              # TypeScript definitions
│   │   └── utils/              # Utility functions
│   ├── prisma/                 # Database schema & migrations
│   └── package.json
│
├── restaurant-frontend/         # Next.js Frontend Application
│   ├── src/
│   │   ├── components/         # React components
│   │   │   └── SecurePaymentProcessor.tsx
│   │   ├── lib/                # Client-side utilities
│   │   │   └── api-client.ts   # API client with interceptors
│   │   ├── store/              # State management
│   │   │   └── auth.ts         # Authentication store
│   │   └── ...
│   └── package.json
│
└── restaurant-app/             # Original monolithic app (for reference)
```

## 🚀 Setup Instructions

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd restaurant-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   ```bash
   cp .env.example .env
   ```
   
   Configure the following variables in `.env`:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/restaurant_db"
   
   # JWT
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=7d
   
   # Razorpay (Critical for payments)
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   
   # Email (for invoice delivery)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   
   # SMS (for invoice delivery)
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   
   # Security
   FRONTEND_URL=http://localhost:3000
   ENCRYPTION_KEY=your-32-character-encryption-key-here
   ```

4. **Database Setup:**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run migrations
   npx prisma migrate dev
   
   # Seed database (optional)
   npm run db:seed
   ```

5. **Start Backend Server:**
   ```bash
   npm run dev
   ```
   Backend will run on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd restaurant-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Configure the following variables in `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
   NEXT_PUBLIC_APP_NAME=Restaurant Online Ordering
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Start Frontend Application:**
   ```bash
   npm run dev
   ```
   Frontend will run on `http://localhost:3000`

## 🔐 Security Implementation Details

### Payment Flow Security

1. **Order Creation**: Orders created with PENDING payment status
2. **Payment Initiation**: 
   - Frontend requests payment creation from backend
   - Backend creates Razorpay order with secure notes
   - Returns encrypted payment data to frontend
3. **Payment Processing**:
   - Razorpay handles payment collection
   - Frontend receives payment response
   - Payment signature verified on backend only
4. **Payment Verification**:
   - Backend verifies Razorpay signature using HMAC-SHA256
   - Order status updated only after successful verification
   - Payment details logged for audit trail

### Invoice Generation Security

1. **Eligibility Check**: Only completed payments can generate invoices
2. **Data Validation**: All invoice data validated with Zod schemas
3. **Secure PDF Generation**: PDFs generated server-side with jsPDF
4. **Controlled Access**: Users can only access their own invoices
5. **Delivery Tracking**: Email/SMS delivery status tracked in database

## 🛡️ Security Features Summary

- ✅ **Secure Payment Processing**: End-to-end encryption with Razorpay
- ✅ **JWT Authentication**: Stateless token-based authentication
- ✅ **Payment Signature Verification**: Server-side signature validation
- ✅ **Rate Limiting**: Protection against DDoS and brute force
- ✅ **CORS Configuration**: Controlled cross-origin access
- ✅ **Input Validation**: Comprehensive data validation with Zod
- ✅ **Error Handling**: Centralized error handling with logging
- ✅ **Secure Invoice Generation**: Post-payment verification required
- ✅ **Access Control**: User-specific data access
- ✅ **Audit Logging**: Comprehensive logging for security events

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get user profile
- `PUT /api/auth/change-password` - Change password

### Payments (Secured)
- `POST /api/payments/create` - Create payment order
- `POST /api/payments/verify` - Verify payment signature
- `GET /api/payments/status/:orderId` - Get payment status
- `POST /api/payments/refund` - Process refund

### Invoices (Post-Payment)
- `POST /api/invoices/generate` - Generate & send invoice
- `GET /api/invoices/:orderId` - Get invoice details
- `GET /api/invoices/user/list` - Get user invoices
- `POST /api/invoices/:invoiceId/resend` - Resend invoice

## 🚦 Testing the Separated Architecture

### 1. Test Backend API
```bash
# Health check
curl http://localhost:5000/health

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

### 2. Test Frontend Integration
1. Open `http://localhost:3000`
2. Register/Login to get authentication token
3. Place an order to test payment flow
4. Complete payment to test invoice generation

### 3. Test Payment Security
1. Monitor backend logs during payment processing
2. Verify signature validation in logs
3. Test payment with invalid signatures (should fail)
4. Verify order status updates only after successful verification

## 📈 Scalability Benefits

### Backend Scalability
- **Horizontal Scaling**: Multiple backend instances behind load balancer
- **Database Connection Pooling**: Prisma connection optimization
- **Caching**: Redis integration ready for session/data caching
- **Microservices Ready**: Each service (payments, invoices) can be separated further

### Frontend Scalability
- **CDN Integration**: Static assets can be served via CDN
- **API Client Optimization**: Request/response interceptors for caching
- **State Management**: Zustand for efficient state updates
- **Code Splitting**: Next.js automatic code splitting

## 🔄 Deployment Architecture

### Production Setup
```
Load Balancer
    ├── Frontend (Next.js) - Port 3000
    │   └── Static Assets (CDN)
    └── Backend API (Express) - Port 5000
        ├── Database (PostgreSQL)
        ├── File Storage (AWS S3/Local)
        └── External Services
            ├── Razorpay (Payments)
            ├── SMTP (Email)
            └── Twilio (SMS)
```

### Docker Configuration (Optional)
Backend Dockerfile and docker-compose.yml files can be created for containerized deployment.

## 📝 Migration Notes

### From Monolithic to Separated Architecture

1. **Database**: Same Prisma schema used in both architectures
2. **Authentication**: Migrated from NextAuth to JWT tokens
3. **Payment Flow**: Enhanced security with backend verification
4. **Invoice Generation**: More secure post-payment generation
5. **API Structure**: RESTful endpoints with proper HTTP methods

### Breaking Changes
- Frontend now uses JWT tokens instead of NextAuth sessions
- Payment verification moved to backend (more secure)
- Invoice generation requires API calls instead of server actions

## 🤝 Contributing

### Development Workflow
1. Backend changes: Update API endpoints and test with Postman/curl
2. Frontend changes: Update API client and test integration
3. Database changes: Update Prisma schema and run migrations
4. Security updates: Review authentication and payment flows

### Code Quality
- TypeScript strict mode enabled
- ESLint and Prettier configured
- Comprehensive error handling
- Security-focused code reviews

## 📚 Additional Resources

- [Razorpay Documentation](https://razorpay.com/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Status**: ✅ Backend and Frontend successfully separated with enhanced security
**Next Steps**: Deploy to production environment with proper SSL certificates and monitoring