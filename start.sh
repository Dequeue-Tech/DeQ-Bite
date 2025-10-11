#!/bin/bash

echo "Starting Restaurant application..."

echo "Installing dependencies for backend..."
cd restaurant-backend && npm install
cd ..

echo "Installing dependencies for frontend..."
cd restaurant-frontend && npm install
cd ..

echo "Building backend..."
cd restaurant-backend && npm run build
cd ..

echo "Building frontend..."
cd restaurant-frontend && npm run build
cd ..

echo "Starting backend server..."
cd restaurant-backend && npm start &
BACKEND_PID=$!

echo "Starting frontend server..."
cd restaurant-frontend && npm start

# Wait for processes
timeout 30s tail --pid=$BACKEND_PID -f /dev/null

echo "Application started successfully!"