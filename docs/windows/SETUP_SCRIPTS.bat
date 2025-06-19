@echo off
REM ProcessMaster Pro Windows Setup Script
REM This script helps set up the development environment on Windows

setlocal enabledelayedexpansion

echo ========================================
echo ProcessMaster Pro Windows Setup
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo [1/7] Checking Windows version...
for /f "tokens=4-5 delims=. " %%i in ('ver') do set VERSION=%%i.%%j
if "%VERSION%" lss "10.0" (
    echo ERROR: Windows 10 or later is required
    pause
    exit /b 1
)
echo Windows version check passed

echo.
echo [2/7] Checking if WSL is installed...
wsl --list >nul 2>&1
if %errorLevel% neq 0 (
    echo WSL not found. Installing WSL2...
    
    echo Enabling WSL feature...
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    
    echo Enabling Virtual Machine Platform...
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
    
    echo Installing WSL2...
    wsl --install -d Ubuntu
    
    echo.
    echo WSL2 installation initiated. A restart may be required.
    echo After restart, please run this script again.
    pause
    exit /b 0
) else (
    echo WSL is already installed
)

echo.
echo [3/7] Setting WSL2 as default version...
wsl --set-default-version 2

echo.
echo [4/7] Checking Docker Desktop installation...
docker --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Docker Desktop not found.
    echo.
    echo Please install Docker Desktop for Windows:
    echo https://docs.docker.com/desktop/install/windows-install/
    echo.
    echo Make sure to:
    echo 1. Enable "Use the WSL2 based engine" during installation
    echo 2. Enable WSL2 integration after installation
    echo.
    echo After installing Docker Desktop, run this script again.
    pause
    exit /b 1
) else (
    echo Docker Desktop is installed
)

echo.
echo [5/7] Checking Docker Compose...
docker compose version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Docker Compose not found
    echo Please ensure Docker Desktop is properly installed
    pause
    exit /b 1
) else (
    echo Docker Compose is available
)

echo.
echo [6/7] Testing Docker...
docker run --rm hello-world >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Docker test failed
    echo Please ensure Docker Desktop is running
    pause
    exit /b 1
) else (
    echo Docker test passed
)

echo.
echo [7/7] Setting up Windows Defender exclusions...
powershell -Command "Add-MpPreference -ExclusionPath 'C:\Development'" 2>nul
powershell -Command "Add-MpPreference -ExclusionPath '%LOCALAPPDATA%\Docker'" 2>nul
echo Windows Defender exclusions added (if permissions allow)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Clone the ProcessMaster Pro repository
echo 2. Navigate to the project directory
echo 3. Run setup-project.bat to configure the project
echo.
echo For detailed instructions, see:
echo docs\windows\GETTING_STARTED.md
echo.
pause