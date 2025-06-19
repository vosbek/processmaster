@echo off
REM ProcessMaster Pro Project Setup Script for Windows
REM Run this script from the project root directory

setlocal enabledelayedexpansion

echo ========================================
echo ProcessMaster Pro Project Setup
echo ========================================
echo.

REM Check if we're in the correct directory
if not exist "package.json" (
    echo ERROR: package.json not found
    echo Please run this script from the ProcessMaster Pro project root directory
    pause
    exit /b 1
)

if not exist "docker-compose.yml" (
    echo ERROR: docker-compose.yml not found
    echo Please run this script from the ProcessMaster Pro project root directory
    pause
    exit /b 1
)

echo [1/6] Checking Docker Desktop status...
docker version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Docker Desktop is not running
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)
echo Docker Desktop is running

echo.
echo [2/6] Setting up environment configuration...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env"
        echo Created .env file from template
        echo.
        echo IMPORTANT: Please edit .env file with your configuration:
        echo - AWS credentials
        echo - Database settings
        echo - JWT secrets
        echo.
        echo Press any key to open .env file in notepad...
        pause >nul
        notepad .env
    ) else (
        echo ERROR: .env.example file not found
        pause
        exit /b 1
    )
) else (
    echo .env file already exists
)

echo.
echo [3/6] Creating necessary directories...
if not exist "logs" mkdir logs
if not exist "uploads" mkdir uploads
if not exist "database\init" mkdir database\init
if not exist "nginx" mkdir nginx
echo Directories created

echo.
echo [4/6] Building Docker images...
echo This may take several minutes on first run...
docker compose build
if %errorLevel% neq 0 (
    echo ERROR: Docker build failed
    echo Check the error messages above
    pause
    exit /b 1
)
echo Docker images built successfully

echo.
echo [5/6] Starting services...
docker compose up -d
if %errorLevel% neq 0 (
    echo ERROR: Failed to start services
    echo Check the error messages above
    pause
    exit /b 1
)

echo.
echo [6/6] Waiting for services to be ready...
echo This may take a few minutes...

REM Wait for database
echo Waiting for database...
:wait_db
timeout /t 5 /nobreak >nul
docker exec processmaster-db pg_isready -U processmaster -d processmaster_pro >nul 2>&1
if %errorLevel% neq 0 goto wait_db
echo Database is ready

REM Wait for API
echo Waiting for API...
:wait_api
timeout /t 5 /nobreak >nul
curl -f http://localhost:3001/health >nul 2>&1
if %errorLevel% neq 0 goto wait_api
echo API is ready

REM Wait for Web app
echo Waiting for web application...
:wait_web
timeout /t 5 /nobreak >nul
curl -f http://localhost:3000 >nul 2>&1
if %errorLevel% neq 0 goto wait_web
echo Web application is ready

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Your ProcessMaster Pro development environment is ready!
echo.
echo Access URLs:
echo - Web Application: http://localhost:3000
echo - API: http://localhost:3001
echo - Database: localhost:5432
echo.
echo Useful commands:
echo - Check status: docker compose ps
echo - View logs: docker compose logs -f
echo - Stop services: docker compose down
echo - Restart: docker compose restart
echo.
echo Chrome Extension:
echo 1. Navigate to apps\chrome-extension
echo 2. Run: npm install
echo 3. Run: npm run build
echo 4. Load the dist folder in Chrome extensions
echo.
echo For troubleshooting, see: docs\windows\TROUBLESHOOTING.md
echo.

REM Open browser
set /p OPEN_BROWSER="Open web application in browser? (y/n): "
if /i "%OPEN_BROWSER%"=="y" (
    start http://localhost:3000
)

echo.
pause