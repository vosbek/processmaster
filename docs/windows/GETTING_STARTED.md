# ProcessMaster Pro - Windows Getting Started Guide

This guide will help you set up and run ProcessMaster Pro on Windows using Docker Desktop and Windows Subsystem for Linux (WSL2).

## Prerequisites

### Required Software

1. **Windows 10 version 2004+ or Windows 11**
   - Enable WSL2 (Windows Subsystem for Linux 2)
   - Enable Hyper-V

2. **Docker Desktop for Windows**
   - Download from: https://docs.docker.com/desktop/install/windows-install/
   - Requires WSL2 backend

3. **Git for Windows**
   - Download from: https://git-scm.com/download/win
   - Or use GitHub Desktop: https://desktop.github.com/

4. **Node.js 18+ (Optional)**
   - Download from: https://nodejs.org/
   - Only needed for local development without Docker

## Step 1: Enable WSL2

### 1.1 Enable WSL Feature

Open **PowerShell as Administrator** and run:

```powershell
# Enable WSL feature
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Enable Virtual Machine Platform
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Restart your computer
Restart-Computer
```

### 1.2 Set WSL2 as Default

After restart, open **PowerShell as Administrator**:

```powershell
# Set WSL2 as default version
wsl --set-default-version 2

# Install Ubuntu (or your preferred Linux distribution)
wsl --install -d Ubuntu
```

### 1.3 Verify WSL2 Installation

```powershell
# Check WSL version
wsl --list --verbose

# Should show VERSION 2 for your Ubuntu installation
```

## Step 2: Install Docker Desktop

### 2.1 Download and Install

1. Download Docker Desktop from: https://docs.docker.com/desktop/install/windows-install/
2. Run the installer as Administrator
3. During installation, ensure "Enable WSL2 Features" is checked
4. Restart your computer when prompted

### 2.2 Configure Docker Desktop

1. Open Docker Desktop
2. Go to **Settings** → **General**
3. Ensure "Use the WSL2 based engine" is checked
4. Go to **Settings** → **Resources** → **WSL Integration**
5. Enable integration with your Ubuntu distribution

### 2.3 Verify Docker Installation

Open **Command Prompt** or **PowerShell**:

```cmd
# Check Docker version
docker --version

# Check Docker Compose version
docker compose version

# Test Docker installation
docker run hello-world
```

## Step 3: Clone and Setup ProcessMaster Pro

### 3.1 Clone the Repository

Using **Command Prompt**, **PowerShell**, or **Git Bash**:

```cmd
# Navigate to your desired directory (e.g., C:\Development)
cd C:\Development

# Clone the repository
git clone <repository-url> processmaster-pro
cd processmaster-pro
```

### 3.2 Initial Setup

#### Option A: Using Windows Command Prompt/PowerShell

```cmd
# Copy environment file
copy .env.example .env

# Edit the .env file with your configuration
notepad .env
```

#### Option B: Using WSL2 Ubuntu Terminal

```bash
# Open WSL2 terminal and navigate to the project
cd /mnt/c/Development/processmaster-pro

# Make scripts executable
chmod +x scripts/*.sh

# Run setup script
./scripts/dev-setup.sh
```

### 3.3 Configure Environment Variables

Edit the `.env` file with your specific configuration:

```env
# Database Configuration
DATABASE_URL=postgresql://processmaster:dev_password_123@localhost:5432/processmaster_pro

# AWS Configuration (replace with your actual values)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_BUCKET=your-s3-bucket-name

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret_here

# Application URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 4: Start Development Environment

### 4.1 Using Docker Compose (Recommended)

#### Option A: Windows Command Prompt/PowerShell

```cmd
# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

#### Option B: Using Make in WSL2

```bash
# In WSL2 terminal
cd /mnt/c/Development/processmaster-pro

# Start development environment
make start

# Or use individual commands
make setup
make start
make logs
```

### 4.2 Verify Services Are Running

Check that all services are healthy:

```cmd
# Check Docker containers
docker ps

# Test web application
# Open browser and go to: http://localhost:3000

# Test API
# Open browser and go to: http://localhost:3001/health
```

## Step 5: Access the Application

Once all services are running:

- **Web Application**: http://localhost:3000
- **API**: http://localhost:3001
- **Database**: localhost:5432 (if needed for database tools)

## Step 6: Install Chrome Extension (Optional)

### 6.1 Build the Extension

#### In WSL2:
```bash
cd /mnt/c/Development/processmaster-pro/apps/chrome-extension
npm install
npm run build
```

#### In Windows:
```cmd
cd apps\chrome-extension
npm install
npm run build
```

### 6.2 Load Extension in Chrome

1. Open Google Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Navigate to `processmaster-pro\apps\chrome-extension\dist`
6. Select the folder and click "Select Folder"

## Troubleshooting

### Common Issues

#### 1. Docker Desktop Won't Start

**Symptoms**: Docker Desktop fails to start or shows WSL2 errors.

**Solutions**:
```powershell
# Check Windows features
Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux
Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform

# Update WSL2
wsl --update

# Restart Docker Desktop
# Right-click Docker Desktop in system tray → Restart
```

#### 2. Port Already in Use

**Symptoms**: Error messages about ports 3000, 3001, or 5432 being in use.

**Solutions**:
```cmd
# Check what's using the ports
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :5432

# Kill processes if needed (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or use different ports by modifying docker-compose.yml
```

#### 3. Permission Issues with WSL2

**Symptoms**: Cannot access files or run scripts in WSL2.

**Solutions**:
```bash
# Fix permissions
sudo chown -R $USER:$USER /mnt/c/Development/processmaster-pro
chmod +x scripts/*.sh

# Or run with sudo
sudo ./scripts/dev-setup.sh
```

#### 4. Database Connection Issues

**Symptoms**: Cannot connect to PostgreSQL database.

**Solutions**:
```cmd
# Check if database container is running
docker ps | findstr postgres

# Check database logs
docker logs processmaster-db

# Reset database
docker compose down -v
docker compose up -d
```

#### 5. Node.js Version Issues

**Symptoms**: npm install fails or version conflicts.

**Solutions**:
```cmd
# Check Node.js version
node --version

# Should be 18.x or higher
# If not, download from https://nodejs.org/

# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rmdir /s node_modules
npm install
```

### Performance Tips

#### 1. WSL2 Performance

- Store project files in WSL2 filesystem (`~/projects/`) instead of Windows filesystem (`/mnt/c/`) for better performance
- Use WSL2 terminal for all development commands

#### 2. Docker Performance

```cmd
# Increase Docker resources
# Docker Desktop → Settings → Resources
# - CPUs: 4 or more
# - Memory: 8GB or more
# - Disk image size: 100GB or more
```

#### 3. Windows Defender Exclusions

Add these folders to Windows Defender exclusions:
- `C:\Development\processmaster-pro`
- WSL2 installation directory
- Docker Desktop directory

### Useful Commands

```cmd
# Windows Commands
docker compose up -d              # Start services
docker compose down              # Stop services
docker compose logs -f           # View logs
docker compose ps               # Check status
docker system prune -f          # Clean up Docker

# WSL2 Commands (run in WSL2 terminal)
make start                      # Start development
make stop                       # Stop development
make logs                       # View logs
make reset                      # Reset everything
make health                     # Check service health
```

## Development Workflow

### Daily Development

1. **Start services**:
   ```cmd
   docker compose up -d
   ```

2. **Check health**:
   ```cmd
   docker compose ps
   ```

3. **View logs** (if needed):
   ```cmd
   docker compose logs -f api
   docker compose logs -f web
   ```

4. **Stop services** (when done):
   ```cmd
   docker compose down
   ```

### Making Changes

- **Frontend changes**: Edit files in `apps/web/src/`
- **Backend changes**: Edit files in `apps/api/src/`
- **Database changes**: Run migrations with `make migrate` (in WSL2)

Changes are automatically reloaded in development mode.

### Running Tests

```cmd
# In WSL2
make test              # All tests
make test-api          # API tests only
make test-web          # Frontend tests only
```

## Next Steps

1. **Read the main documentation**: `../DEVELOPMENT.md`
2. **Review the API documentation**: Start the development environment and visit the API docs
3. **Explore the codebase**: Familiarize yourself with the project structure
4. **Set up your IDE**: Configure VS Code or your preferred editor for the project

## Getting Help

- **Issues**: Create GitHub issues for bugs or feature requests
- **Documentation**: Check the `/docs` directory for detailed guides
- **Logs**: Always check Docker logs when troubleshooting
- **Discord/Slack**: Join the development community (if available)

## Additional Resources

- [Docker Desktop Documentation](https://docs.docker.com/desktop/windows/)
- [WSL2 Documentation](https://docs.microsoft.com/en-us/windows/wsl/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)