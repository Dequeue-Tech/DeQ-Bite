# 🍽️ Restaurant Online Ordering System - Separated Architecture

A modern, scalable restaurant web application with **separated backend and frontend** for enhanced security and scalability.

## 🏗️ Architecture Overview

This project has been **successfully separated** into independent, scalable services:

- **Backend API Server** (`restaurant-backend/`) - Express.js + TypeScript + Prisma
- **Frontend Application** (`restaurant-frontend/`) - Next.js + React + TypeScript

## 🔐 Enhanced Security Features

### Payment Security
- ✅ **Server-side signature verification** for all Razorpay payments
- ✅ **JWT authentication** with configurable expiration
- ✅ **Rate limiting** to prevent abuse and attacks
- ✅ **CORS protection** for controlled API access
- ✅ **Input validation** using Zod schemas

### Invoice Security  
- ✅ **Post-payment verification** - Invoices only generated after successful payment
- ✅ **Secure PDF generation** with controlled file storage
- ✅ **User-specific access control** - Users can only access their own invoices
- ✅ **Multi-channel delivery** with delivery confirmation tracking

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Razorpay account (for payments)

### 1. Automated Setup (Recommended)
```bash
# Windows
.\setup-separated-app.bat

# Linux/macOS  
chmod +x setup-separated-app.sh
./setup-separated-app.sh
```

### 2. Manual Setup

#### Backend Setup
```bash
cd restaurant-backend
npm install
cp .env.example .env
# Edit .env with your credentials
npx prisma generate
npx prisma migrate dev
npm run dev  # Runs on http://localhost:5000
```

#### Frontend Setup
```bash
cd restaurant-frontend  
npm install
# Create .env.local with your API URL and Razorpay key
npm run dev  # Runs on http://localhost:3000
```

## 📊 Project Structure

```
Restaurant/
├── restaurant-backend/          # Express.js API Server (Port 5000)
│   ├── src/
│   │   ├── routes/             # API endpoints
│   │   │   ├── auth.ts         # JWT authentication
│   │   │   ├── payments.ts     # Secure payment processing
│   │   │   ├── invoices.ts     # Post-payment invoice generation
│   │   │   └── ...
│   │   ├── lib/                # Business logic
│   │   │   ├── razorpay.ts     # Payment gateway integration
│   │   │   ├── pdf.ts          # PDF generation
│   │   │   ├── email.ts        # Email service
│   │   │   ├── sms.ts          # SMS service
│   │   │   └── sampleData.ts   # Fallback data
│   │   ├── middleware/         # Security middleware
│   │   ├── config/             # Database & app configuration  
│   │   └── types/              # TypeScript definitions
│   ├── prisma/                 # Database schema
│   └── package.json
│
├── restaurant-frontend/         # Next.js Frontend (Port 3000)
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── lib/                # API client & utilities
│   │   ├── store/              # State management (Zustand)
│   │   └── ...
│   └── package.json
│
├── SEPARATION_GUIDE.md         # Detailed technical documentation
├── SAMPLE_DATA.md              # Test credentials & sample data
└── setup-separated-app.*       # Automated setup scripts
```

## 🔑 Test Credentials

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Admin | `admin@restaurant.com` | `admin123` | Full admin access |
| Customer | `customer@example.com` | `customer123` | Order placement |
| Customer | `jane@example.com` | `jane123` | Order placement |

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login  
- `GET /api/auth/me` - Get user profile

### Secure Payments
- `POST /api/payments/create` - Create payment order
- `POST /api/payments/verify` - Verify payment signature
- `GET /api/payments/status/:orderId` - Get payment status

### Invoices (Post-Payment Only)
- `POST /api/invoices/generate` - Generate & send invoice
- `GET /api/invoices/:orderId` - Get invoice details
- `GET /api/invoices/user/list` - Get user invoices

## 🔒 Security Implementation

### Payment Flow
1. **Order Creation** → Backend validates and creates order
2. **Payment Initiation** → Frontend requests payment from backend API
3. **Razorpay Processing** → User completes payment on Razorpay
4. **Signature Verification** → Backend verifies payment signature (HMAC-SHA256)
5. **Order Confirmation** → Order status updated only after verification
6. **Invoice Generation** → Automated invoice generation for completed payments

### Key Security Measures
- All payment signatures verified server-side
- JWT tokens with automatic refresh
- Rate limiting (100 requests per 15 minutes)
- CORS protection with configurable origins
- Input validation on all endpoints
- Comprehensive audit logging
- Secure file storage for invoices

## 🎯 Scalability Benefits

### Independent Scaling
- Backend and frontend can scale independently
- Microservices-ready architecture
- Database connection pooling with Prisma
- CDN-ready frontend assets

### Performance Optimizations
- API response caching strategies
- Optimized database queries
- Efficient state management
- Code splitting and lazy loading

## 🧪 Testing

### Backend Testing
```bash
cd restaurant-backend
# Test health endpoint
curl http://localhost:5000/health

# Test authentication
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@example.com","password":"customer123"}'
```

### Frontend Testing
1. Open `http://localhost:3000`
2. Login with test credentials
3. Place an order and test payment flow
4. Verify invoice generation

## 📖 Documentation

- **[SEPARATION_GUIDE.md](./SEPARATION_GUIDE.md)** - Complete technical documentation
- **[SAMPLE_DATA.md](./SAMPLE_DATA.md)** - Test data and credentials
- **API Documentation** - Interactive docs available at backend `/health` endpoint

## 🚢 Deployment

### Production Environment Variables

#### Backend (.env)
```env
DATABASE_URL="postgresql://user:pass@host:5432/db"
JWT_SECRET="your-secure-jwt-secret"
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_SECRET="your_live_secret"
FRONTEND_URL="https://your-frontend-domain.com"
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL="https://your-backend-api.com/api"
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_live_..."
```

### Docker Support (Optional)
Dockerfile configurations can be added for containerized deployment.

## 📈 Monitoring & Logs

- **Backend Logs**: `restaurant-backend/logs/`
- **Error Tracking**: Winston logger with file rotation
- **Payment Audit**: All payment events logged with timestamps
- **Security Events**: Authentication failures and rate limit hits tracked

## 🛠️ Development

### Adding New Features
1. **Backend**: Add routes in `src/routes/`, implement logic in `src/lib/`
2. **Frontend**: Create components in `src/components/`, update API client
3. **Database**: Modify Prisma schema, run migrations
4. **Testing**: Test APIs with Postman, test UI functionality

### Code Quality
- TypeScript strict mode enabled
- ESLint and Prettier configured  
- Security-focused code reviews
- Comprehensive error handling

## 🤝 Contributing

1. Follow existing code structure and patterns
2. Implement proper error handling and logging
3. Add appropriate input validation
4. Test payment flows thoroughly
5. Update documentation for new features

## 📞 Support

For technical issues:
1. Check logs in `restaurant-backend/logs/`
2. Verify environment configuration
3. Test API endpoints individually
4. Review payment gateway settings

---

**Status**: ✅ **Production Ready** - Separated architecture with enhanced security  
**Version**: 1.0.0 - Scalable Restaurant Ordering System  
**Last Updated**: January 2024