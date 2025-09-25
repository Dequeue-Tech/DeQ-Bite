@echo off
REM Restaurant App - Backend & Frontend Separation
REM Quick Start Script for Windows

echo 🍽️ Restaurant App - Separated Architecture Setup
echo =================================================

REM Check if we're in the right directory
if not exist "restaurant-backend" (
    echo ❌ Error: Please run this script from the Restaurant directory
    echo Expected directory structure:
    echo   Restaurant/
    echo   ├── restaurant-backend/
    echo   └── restaurant-frontend/
    exit /b 1
)

if not exist "restaurant-frontend" (
    echo ❌ Error: Please run this script from the Restaurant directory
    echo Expected directory structure:
    echo   Restaurant/
    echo   ├── restaurant-backend/
    echo   └── restaurant-frontend/
    exit /b 1
)

echo 📋 Setting up separated backend and frontend...

REM Backend Setup
echo.
echo 🔧 Setting up Backend (Express.js + TypeScript)...
cd restaurant-backend

if not exist ".env" (
    echo ⚙️ Creating backend .env file...
    copy .env.example .env
    echo ⚠️  IMPORTANT: Please update the .env file with your actual credentials:
    echo   - DATABASE_URL (PostgreSQL connection^)
    echo   - RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
    echo   - SMTP credentials for email
    echo   - JWT_SECRET (make it secure^)
)

if not exist "node_modules" (
    echo 📦 Installing backend dependencies...
    npm install
)

echo 🗄️ Setting up database...
npx prisma generate
echo ✅ Backend setup complete!

REM Frontend Setup
echo.
echo 🎨 Setting up Frontend (Next.js + React)...
cd ..\restaurant-frontend

if not exist ".env.local" (
    echo ⚙️ Creating frontend .env.local file...
    (
        echo NEXT_PUBLIC_API_URL=http://localhost:5000/api
        echo NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
        echo NEXT_PUBLIC_APP_NAME=Restaurant Online Ordering
        echo NEXT_PUBLIC_APP_URL=http://localhost:3000
    ) > .env.local
    echo ⚠️  IMPORTANT: Please update NEXT_PUBLIC_RAZORPAY_KEY_ID in .env.local
)

if not exist "node_modules" (
    echo 📦 Installing frontend dependencies...
    npm install
)

echo ✅ Frontend setup complete!

REM Final Instructions
echo.
echo 🎉 Setup Complete! Here's how to start the applications:
echo.
echo Backend Server (Express.js^):
echo   cd restaurant-backend
echo   npm run dev
echo   → Runs on http://localhost:5000
echo.
echo Frontend Application (Next.js^):
echo   cd restaurant-frontend
echo   npm run dev
echo   → Runs on http://localhost:3000
echo.
echo 📝 Important Configuration Steps:
echo 1. Update restaurant-backend/.env with your database and API credentials
echo 2. Update restaurant-frontend/.env.local with your Razorpay public key
echo 3. Ensure PostgreSQL is running and database exists
echo 4. Run 'npx prisma migrate dev' in backend if needed
echo.
echo 🔒 Security Features Implemented:
echo ✅ Secure payment processing with signature verification
echo ✅ JWT-based authentication
echo ✅ Invoice generation only after successful payments
echo ✅ Rate limiting and CORS protection
echo ✅ Input validation and error handling
echo.
echo 📖 For detailed documentation, see: SEPARATION_GUIDE.md
echo 🚀 Your restaurant app is now ready for scalable deployment!

cd ..
pause