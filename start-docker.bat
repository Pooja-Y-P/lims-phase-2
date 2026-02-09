@echo off
REM LIMS Project Docker Startup Script for Windows

echo 🚀 Starting LIMS Project with Docker...
echo.

REM Check if .env file exists
if not exist .env (
    echo ⚠️  .env file not found!
    echo 📋 Copying env.template to .env...
    copy env.template .env
    echo ✅ Created .env file from template
    echo.
    echo ⚠️  IMPORTANT: Please edit .env and update the following:
    echo    - SECRET_KEY (generate a secure random key)
    echo    - Email settings (if using email functionality)
    echo.
    pause
)

echo 🏗️  Building Docker images...
docker-compose build

echo.
echo 🔄 Starting all services...
docker-compose up -d

echo.
echo ⏳ Waiting for services to be ready...
timeout /t 5 /nobreak >nul

echo.
echo 📊 Service Status:
docker-compose ps

echo.
echo ✅ LIMS Project is starting!
echo.
echo 📱 Access the application at:
echo    - Frontend:  http://localhost:3000
echo    - Backend:   http://192.168.31.195:8000
echo    - API Docs:  http://192.168.31.195:8000/docs
echo    - pgAdmin:   http://localhost:5050
echo.
echo 📝 View logs with: docker-compose logs -f
echo 🛑 Stop services with: docker-compose down
echo.
echo 📖 For more information, see DOCKER_SETUP.md
echo.
pause

