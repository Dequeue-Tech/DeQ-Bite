#!/bin/bash

# Restaurant App Deployment Script for Unix/Linux systems

echo "🚀 Starting Restaurant App Deployment..."

# Set variables
BACKEND_DIR="restaurant-backend"
FRONTEND_DIR="restaurant-frontend"
DB_NAME="restaurant_db"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL is not found. Make sure you have a PostgreSQL database available."
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd $BACKEND_DIR
if [ ! -f "package.json" ]; then
    print_error "Backend package.json not found!"
    exit 1
fi

npm install
if [ $? -ne 0 ]; then
    print_error "Failed to install backend dependencies"
    exit 1
fi
print_status "Backend dependencies installed"

# Copy environment file if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning "Created .env from .env.example. Please update with your actual configuration."
    else
        print_error ".env.example not found. Please create .env file manually."
        exit 1
    fi
fi

# Build backend
echo "🔨 Building backend..."
npm run build
if [ $? -ne 0 ]; then
    print_error "Failed to build backend"
    exit 1
fi
print_status "Backend built successfully"

# Generate Prisma client
echo "🗄️  Generating Prisma client..."
npx prisma generate
if [ $? -ne 0 ]; then
    print_error "Failed to generate Prisma client"
    exit 1
fi
print_status "Prisma client generated"

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy
if [ $? -eq 0 ]; then
    print_status "Database migrations completed"
else
    print_warning "Database migrations failed. You may need to set up the database manually."
fi

# Seed database
echo "🌱 Seeding database..."
npm run db:seed
if [ $? -eq 0 ]; then
    print_status "Database seeded successfully"
else
    print_warning "Database seeding failed. You may need to seed manually."
fi

# Go to frontend directory
cd ../$FRONTEND_DIR

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
if [ ! -f "package.json" ]; then
    print_error "Frontend package.json not found!"
    exit 1
fi

npm install
if [ $? -ne 0 ]; then
    print_error "Failed to install frontend dependencies"
    exit 1
fi
print_status "Frontend dependencies installed"

# Copy environment file if it doesn't exist
if [ ! -f ".env.local" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        print_warning "Created .env.local from .env.example. Please update with your actual configuration."
    else
        print_error ".env.example not found. Please create .env.local file manually."
    fi
fi

# Build frontend
echo "🔨 Building frontend..."
npm run build
if [ $? -ne 0 ]; then
    print_error "Failed to build frontend"
    exit 1
fi
print_status "Frontend built successfully"

# Go back to root directory
cd ..

echo ""
print_status "🎉 Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env files in both backend and frontend with your actual configuration"
echo "2. Set up your PostgreSQL database and update DATABASE_URL"
echo "3. Configure Razorpay, email, and SMS credentials"
echo "4. Start the backend: cd $BACKEND_DIR && npm start"
echo "5. Start the frontend: cd $FRONTEND_DIR && npm start"
echo ""
echo "🌐 Default URLs:"
echo "   Backend:  http://localhost:5000"
echo "   Frontend: http://localhost:3000"
echo "   Admin:    http://localhost:3000/admin"
echo ""
echo "📚 Documentation:"
echo "   - Check README.md for detailed setup instructions"
echo "   - Review SEPARATION_GUIDE.md for architecture details"
echo "   - See SAMPLE_DATA.md for sample data information"