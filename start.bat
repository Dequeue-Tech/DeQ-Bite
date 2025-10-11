@echo off

echo Starting Restaurant application...

echo Installing dependencies for backend...
cd restaurant-backend && npm install
cd ..

echo Installing dependencies for frontend...
cd restaurant-frontend && npm install
cd ..

echo Building backend...
cd restaurant-backend && npm run build
cd ..

echo Building frontend...
cd restaurant-frontend && npm run build
cd ..

echo Starting backend server...
cd restaurant-backend && start /B npm start
set BACKEND_PID=%errorlevel%

echo Starting frontend server...
cd restaurant-frontend && npm start

echo Application started successfully!
pause