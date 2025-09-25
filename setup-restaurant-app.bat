@echo off
REM Restaurant App Deployment Script for Windows

echo 🚀 Starting Restaurant App Deployment...

set BACKEND_DIR=restaurant-backend
set FRONTEND_DIR=restaurant-frontend
set DB_NAME=restaurant_db

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Install backend dependencies
echo 📦 Installing backend dependencies...
cd %BACKEND_DIR%
if not exist "package.json" (
    echo ❌ Backend package.json not found!
    pause
    exit /b 1
)

call npm install
if errorlevel 1 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)
echo ✅ Backend dependencies installed

REM Copy environment file if it doesn't exist
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env"
        echo ⚠️  Created .env from .env.example. Please update with your actual configuration.
    ) else (
        echo ❌ .env.example not found. Please create .env file manually.
        pause
        exit /b 1
    )
)

REM Build backend
echo 🔨 Building backend...
call npm run build
if errorlevel 1 (
    echo ❌ Failed to build backend
    pause
    exit /b 1
)
echo ✅ Backend built successfully

REM Generate Prisma client
echo 🗄️  Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
    echo ❌ Failed to generate Prisma client
    pause
    exit /b 1
)
echo ✅ Prisma client generated

REM Run database migrations
echo 🗄️  Running database migrations...
call npx prisma migrate deploy
if errorlevel 0 (
    echo ✅ Database migrations completed
) else (
    echo ⚠️  Database migrations failed. You may need to set up the database manually.
)

REM Seed database
echo 🌱 Seeding database...
call npm run db:seed
if errorlevel 0 (
    echo ✅ Database seeded successfully
) else (
    echo ⚠️  Database seeding failed. You may need to seed manually.
)

REM Go to frontend directory
cd ..\%FRONTEND_DIR%

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
if not exist "package.json" (
    echo ❌ Frontend package.json not found!
    pause
    exit /b 1
)

call npm install
if errorlevel 1 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)
echo ✅ Frontend dependencies installed

REM Copy environment file if it doesn't exist
if not exist ".env.local" (
    if exist ".env.example" (
        copy ".env.example" ".env.local"
        echo ⚠️  Created .env.local from .env.example. Please update with your actual configuration.
    ) else (
        echo ❌ .env.example not found. Please create .env.local file manually.
    )
)

REM Build frontend
echo 🔨 Building frontend...
call npm run build
if errorlevel 1 (
    echo ❌ Failed to build frontend
    pause
    exit /b 1
)
echo ✅ Frontend built successfully

REM Go back to root directory
cd ..

echo.
echo ✅ 🎉 Deployment completed successfully!
echo.
echo 📋 Next steps:
echo 1. Update .env files in both backend and frontend with your actual configuration
echo 2. Set up your PostgreSQL database and update DATABASE_URL
echo 3. Configure Razorpay, email, and SMS credentials
echo 4. Start the backend: cd %BACKEND_DIR% ^&^& npm start
echo 5. Start the frontend: cd %FRONTEND_DIR% ^&^& npm start
echo.
echo 🌐 Default URLs:
echo    Backend:  http://localhost:5000
echo    Frontend: http://localhost:3000
echo    Admin:    http://localhost:3000/admin
echo.
echo 📚 Documentation:
echo    - Check README.md for detailed setup instructions
echo    - Review SEPARATION_GUIDE.md for architecture details
echo    - See SAMPLE_DATA.md for sample data information
echo.
pause