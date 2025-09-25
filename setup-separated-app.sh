#!/bin/bash

# Restaurant App - Backend & Frontend Separation
# Quick Start Script

set -e

echo "🍽️ Restaurant App - Separated Architecture Setup"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "restaurant-backend" ] || [ ! -d "restaurant-frontend" ]; then
    echo -e "${RED}❌ Error: Please run this script from the Restaurant directory${NC}"
    echo "Expected directory structure:"
    echo "  Restaurant/"
    echo "  ├── restaurant-backend/"
    echo "  └── restaurant-frontend/"
    exit 1
fi

echo -e "${BLUE}📋 Setting up separated backend and frontend...${NC}"

# Backend Setup
echo -e "\n${YELLOW}🔧 Setting up Backend (Express.js + TypeScript)...${NC}"
cd restaurant-backend

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚙️ Creating backend .env file...${NC}"
    cp .env.example .env
    echo -e "${RED}⚠️  IMPORTANT: Please update the .env file with your actual credentials:${NC}"
    echo "  - DATABASE_URL (PostgreSQL connection)"
    echo "  - RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET"
    echo "  - SMTP credentials for email"
    echo "  - JWT_SECRET (make it secure)"
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
    npm install
fi

echo -e "${YELLOW}🗄️ Setting up database...${NC}"
npx prisma generate
echo -e "${GREEN}✅ Backend setup complete!${NC}"

# Frontend Setup
echo -e "\n${YELLOW}🎨 Setting up Frontend (Next.js + React)...${NC}"
cd ../restaurant-frontend

if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚙️ Creating frontend .env.local file...${NC}"
    cat > .env.local << EOL
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
NEXT_PUBLIC_APP_NAME=Restaurant Online Ordering
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOL
    echo -e "${RED}⚠️  IMPORTANT: Please update NEXT_PUBLIC_RAZORPAY_KEY_ID in .env.local${NC}"
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
fi

echo -e "${GREEN}✅ Frontend setup complete!${NC}"

# Final Instructions
echo -e "\n${GREEN}🎉 Setup Complete! Here's how to start the applications:${NC}"
echo
echo -e "${BLUE}Backend Server (Express.js):${NC}"
echo "  cd restaurant-backend"
echo "  npm run dev"
echo "  → Runs on http://localhost:5000"
echo
echo -e "${BLUE}Frontend Application (Next.js):${NC}"
echo "  cd restaurant-frontend"
echo "  npm run dev"
echo "  → Runs on http://localhost:3000"
echo
echo -e "${YELLOW}📝 Important Configuration Steps:${NC}"
echo "1. Update restaurant-backend/.env with your database and API credentials"
echo "2. Update restaurant-frontend/.env.local with your Razorpay public key"
echo "3. Ensure PostgreSQL is running and database exists"
echo "4. Run 'npx prisma migrate dev' in backend if needed"
echo
echo -e "${GREEN}🔒 Security Features Implemented:${NC}"
echo "✅ Secure payment processing with signature verification"
echo "✅ JWT-based authentication"
echo "✅ Invoice generation only after successful payments"
echo "✅ Rate limiting and CORS protection"
echo "✅ Input validation and error handling"
echo
echo -e "${BLUE}📖 For detailed documentation, see: SEPARATION_GUIDE.md${NC}"
echo -e "${GREEN}🚀 Your restaurant app is now ready for scalable deployment!${NC}"