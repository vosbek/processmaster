# ProcessMaster Pro - Windows Troubleshooting Guide

This guide covers common issues and solutions when running ProcessMaster Pro on Windows.

## Table of Contents

1. [Docker Desktop Issues](#docker-desktop-issues)
2. [WSL2 Issues](#wsl2-issues)
3. [Network and Port Issues](#network-and-port-issues)
4. [Database Issues](#database-issues)
5. [Development Server Issues](#development-server-issues)
6. [Chrome Extension Issues](#chrome-extension-issues)
7. [Performance Issues](#performance-issues)
8. [File Permission Issues](#file-permission-issues)
9. [Environment Configuration Issues](#environment-configuration-issues)
10. [Build and Compilation Issues](#build-and-compilation-issues)

## Docker Desktop Issues

### Issue: Docker Desktop Won't Start

**Symptoms:**
- Docker Desktop icon shows error state
- "Docker Desktop starting..." never completes
- Error: "WSL 2 installation is incomplete"

**Solutions:**

1. **Enable Required Windows Features:**
   ```powershell
   # Run as Administrator
   Enable-WindowsOptionalFeature -Online -FeatureName containers-DisposableClientVM -All
   Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
   Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -All
   ```

2. **Update WSL2:**
   ```powershell
   wsl --update
   wsl --shutdown
   ```

3. **Reset Docker Desktop:**
   ```powershell
   # Close Docker Desktop completely
   taskkill /f /im "Docker Desktop.exe"
   
   # Clear Docker data (WARNING: This removes all containers and images)
   # %APPDATA%\Docker Desktop\
   ```

4. **Reinstall Docker Desktop:**
   - Uninstall Docker Desktop
   - Download latest version from https://docs.docker.com/desktop/install/windows-install/
   - Install with "Use WSL 2 instead of Hyper-V" option

### Issue: Docker Commands Not Found

**Symptoms:**
- `docker` command not recognized in Command Prompt/PowerShell
- "docker is not recognized as an internal or external command"

**Solutions:**

1. **Restart Docker Desktop**
2. **Check PATH Environment Variable:**
   ```cmd
   echo %PATH%
   # Should include: C:\Program Files\Docker\Docker\resources\bin
   ```
3. **Manually Add to PATH:**
   - Open System Properties → Environment Variables
   - Add `C:\Program Files\Docker\Docker\resources\bin` to PATH

### Issue: Docker Containers Keep Restarting

**Symptoms:**
- Containers show "Restarting" status repeatedly
- Services become unavailable intermittently

**Solutions:**

1. **Check Resource Limits:**
   - Docker Desktop → Settings → Resources
   - Increase Memory to 8GB minimum
   - Increase CPUs to 4 minimum

2. **Check Container Logs:**
   ```cmd
   docker logs processmaster-api
   docker logs processmaster-web
   docker logs processmaster-db
   ```

3. **Reset Docker Environment:**
   ```cmd
   docker compose down -v
   docker system prune -a -f
   docker compose up -d
   ```

## WSL2 Issues

### Issue: WSL2 Not Available

**Symptoms:**
- "WSL 2 requires an update to its kernel component"
- Docker Desktop requires WSL2 but it's not available

**Solutions:**

1. **Install WSL2 Kernel Update:**
   - Download from: https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi
   - Run as Administrator

2. **Enable WSL2:**
   ```powershell
   wsl --set-default-version 2
   wsl --install -d Ubuntu
   ```

3. **Verify Installation:**
   ```powershell
   wsl --list --verbose
   # Should show VERSION 2
   ```

### Issue: WSL2 Performance Problems

**Symptoms:**
- Slow file operations
- Long startup times
- High CPU usage

**Solutions:**

1. **Move Project to WSL2 Filesystem:**
   ```bash
   # Instead of /mnt/c/Development/processmaster-pro
   # Use ~/projects/processmaster-pro
   ```

2. **Configure WSL2 Resources:**
   Create `%UserProfile%\.wslconfig`:
   ```ini
   [wsl2]
   memory=8GB
   processors=4
   localhostForwarding=true
   ```

3. **Restart WSL2:**
   ```powershell
   wsl --shutdown
   # Wait 8 seconds, then start Docker Desktop
   ```

## Network and Port Issues

### Issue: Port Already in Use

**Symptoms:**
- "Error starting userland proxy: listen tcp 0.0.0.0:3000: bind: address already in use"
- Cannot access application on expected ports

**Solutions:**

1. **Find Process Using Port:**
   ```cmd
   netstat -ano | findstr :3000
   netstat -ano | findstr :3001
   netstat -ano | findstr :5432
   ```

2. **Kill Process:**
   ```cmd
   # Replace <PID> with actual Process ID
   taskkill /PID <PID> /F
   ```

3. **Use Different Ports:**
   Edit `docker-compose.yml`:
   ```yaml
   services:
     web:
       ports:
         - "3002:3000"  # Use port 3002 instead
     api:
       ports:
         - "3003:3001"  # Use port 3003 instead
   ```

### Issue: Cannot Access Application from Other Devices

**Symptoms:**
- Application works on localhost but not from other devices on network
- "Connection refused" from other computers

**Solutions:**

1. **Check Windows Firewall:**
   ```powershell
   # Allow ports through firewall
   New-NetFirewallRule -DisplayName "ProcessMaster Web" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   New-NetFirewallRule -DisplayName "ProcessMaster API" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
   ```

2. **Bind to All Interfaces:**
   Update `docker-compose.yml`:
   ```yaml
   ports:
     - "0.0.0.0:3000:3000"
     - "0.0.0.0:3001:3001"
   ```

## Database Issues

### Issue: Database Connection Failed

**Symptoms:**
- "ECONNREFUSED" errors
- "database does not exist" errors
- Application cannot connect to PostgreSQL

**Solutions:**

1. **Check Database Container:**
   ```cmd
   docker ps | findstr postgres
   docker logs processmaster-db
   ```

2. **Reset Database:**
   ```cmd
   docker compose down -v
   docker volume prune -f
   docker compose up -d
   ```

3. **Check Connection String:**
   Verify `.env` file:
   ```env
   DATABASE_URL=postgresql://processmaster:dev_password_123@localhost:5432/processmaster_pro
   ```

4. **Manual Database Creation:**
   ```cmd
   docker exec -it processmaster-db psql -U processmaster
   CREATE DATABASE processmaster_pro;
   \q
   ```

### Issue: Database Migration Errors

**Symptoms:**
- Migration scripts fail
- "relation does not exist" errors
- Schema inconsistencies

**Solutions:**

1. **Reset Database Schema:**
   ```cmd
   # In WSL2 or Git Bash
   ./scripts/db-reset.sh
   ./scripts/db-migrate.sh
   ```

2. **Manual Migration:**
   ```cmd
   docker exec -it processmaster-api npm run migrate
   ```

3. **Check Migration Files:**
   Verify migration files in `apps/api/src/migrations/`

## Development Server Issues

### Issue: Frontend Hot Reload Not Working

**Symptoms:**
- Changes to React components don't appear automatically
- Need to manually refresh browser

**Solutions:**

1. **Check Volume Mounts:**
   Verify `docker-compose.yml`:
   ```yaml
   web:
     volumes:
       - ./apps/web:/app
       - /app/node_modules
   ```

2. **Restart Development Server:**
   ```cmd
   docker compose restart web
   ```

3. **Use WSL2 Filesystem:**
   Move project to WSL2 for better file watching:
   ```bash
   cp -r /mnt/c/Development/processmaster-pro ~/projects/
   ```

### Issue: API Changes Not Reflected

**Symptoms:**
- Backend changes require container restart
- TypeScript compilation errors

**Solutions:**

1. **Check API Logs:**
   ```cmd
   docker logs -f processmaster-api
   ```

2. **Restart API Container:**
   ```cmd
   docker compose restart api
   ```

3. **Clear Node Modules:**
   ```cmd
   docker compose down
   docker volume ls | findstr node_modules
   docker volume rm <node_modules_volume>
   docker compose up -d
   ```

## Chrome Extension Issues

### Issue: Extension Not Loading

**Symptoms:**
- Extension doesn't appear in Chrome extensions page
- "Failed to load extension" errors

**Solutions:**

1. **Check Extension Build:**
   ```cmd
   cd apps/chrome-extension
   npm run build
   # Check if dist/ folder is created
   ```

2. **Verify Manifest:**
   Check `apps/chrome-extension/dist/manifest.json` exists and is valid

3. **Developer Mode:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### Issue: Extension Cannot Connect to API

**Symptoms:**
- Extension shows connection errors
- API requests fail from extension

**Solutions:**

1. **Check CORS Configuration:**
   In API, verify CORS settings allow extension origin

2. **Update Extension Permissions:**
   Check `manifest.json`:
   ```json
   {
     "permissions": [
       "http://localhost:3001/*",
       "activeTab",
       "storage"
     ]
   }
   ```

## Performance Issues

### Issue: Slow Application Performance

**Symptoms:**
- Long page load times
- Laggy user interface
- High CPU usage

**Solutions:**

1. **Increase Docker Resources:**
   - Docker Desktop → Settings → Resources
   - Memory: 8GB minimum
   - CPUs: 4 minimum
   - Disk: 100GB minimum

2. **Add Windows Defender Exclusions:**
   Exclude these folders:
   - `C:\Development\processmaster-pro`
   - `%LOCALAPPDATA%\Docker`
   - WSL2 filesystem

3. **Use WSL2 Filesystem:**
   ```bash
   # Move project to WSL2 for better performance
   mv /mnt/c/Development/processmaster-pro ~/projects/
   ```

4. **Enable Hardware Acceleration:**
   - Docker Desktop → Settings → General
   - Enable "Use the WSL 2 based engine"
   - Enable "Use Docker Compose V2"

### Issue: High Memory Usage

**Symptoms:**
- System becomes slow
- Docker Desktop uses excessive RAM

**Solutions:**

1. **Limit WSL2 Memory:**
   Create `%UserProfile%\.wslconfig`:
   ```ini
   [wsl2]
   memory=6GB
   processors=4
   ```

2. **Restart WSL2:**
   ```powershell
   wsl --shutdown
   ```

3. **Clean Docker System:**
   ```cmd
   docker system prune -a -f
   docker volume prune -f
   ```

## File Permission Issues

### Issue: Permission Denied Errors

**Symptoms:**
- "Permission denied" when running scripts
- Cannot modify files in WSL2

**Solutions:**

1. **Fix Script Permissions:**
   ```bash
   # In WSL2
   chmod +x scripts/*.sh
   ```

2. **Fix Ownership:**
   ```bash
   sudo chown -R $USER:$USER ~/projects/processmaster-pro
   ```

3. **Use WSL2 Terminal:**
   Always use WSL2 terminal for development commands

### Issue: Cannot Edit Files

**Symptoms:**
- Files are read-only
- VS Code cannot save changes

**Solutions:**

1. **Run VS Code from WSL2:**
   ```bash
   # In WSL2 terminal
   code ~/projects/processmaster-pro
   ```

2. **Install WSL Extension:**
   - Install "Remote - WSL" extension in VS Code
   - Use "WSL: New Window" command

## Environment Configuration Issues

### Issue: Environment Variables Not Loaded

**Symptoms:**
- Application shows default values
- Configuration not applied

**Solutions:**

1. **Check .env File Location:**
   - Must be in project root
   - Must be named exactly `.env`

2. **Verify .env Format:**
   ```env
   # No spaces around equals sign
   DATABASE_URL=postgresql://user:pass@host:port/db
   
   # No quotes unless needed
   JWT_SECRET=your_secret_here
   ```

3. **Restart Containers:**
   ```cmd
   docker compose down
   docker compose up -d
   ```

### Issue: AWS Configuration Problems

**Symptoms:**
- S3 upload failures
- Bedrock API errors

**Solutions:**

1. **Verify AWS Credentials:**
   ```env
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   ```

2. **Test AWS Connection:**
   ```cmd
   docker exec -it processmaster-api node -e "
   const AWS = require('aws-sdk');
   const s3 = new AWS.S3();
   s3.listBuckets().promise().then(console.log).catch(console.error);
   "
   ```

## Build and Compilation Issues

### Issue: TypeScript Compilation Errors

**Symptoms:**
- Build fails with type errors
- Development server won't start

**Solutions:**

1. **Clear TypeScript Cache:**
   ```cmd
   # In project directory
   npx tsc --build --clean
   ```

2. **Update Dependencies:**
   ```cmd
   docker exec -it processmaster-api npm update
   docker exec -it processmaster-web npm update
   ```

3. **Check tsconfig.json:**
   Verify TypeScript configuration is correct

### Issue: Node Module Installation Fails

**Symptoms:**
- npm install errors
- Missing dependencies

**Solutions:**

1. **Clear npm Cache:**
   ```cmd
   docker exec -it processmaster-api npm cache clean --force
   ```

2. **Delete node_modules:**
   ```cmd
   docker compose down
   docker volume prune -f
   docker compose up -d --build
   ```

3. **Check Node Version:**
   ```cmd
   docker exec -it processmaster-api node --version
   # Should be 18.x or higher
   ```

## Getting Additional Help

If these solutions don't resolve your issue:

1. **Check Application Logs:**
   ```cmd
   docker logs processmaster-api
   docker logs processmaster-web
   docker logs processmaster-db
   ```

2. **Enable Debug Mode:**
   Add to `.env`:
   ```env
   DEBUG=processmaster:*
   LOG_LEVEL=debug
   ```

3. **Create GitHub Issue:**
   Include:
   - Windows version
   - Docker Desktop version
   - Error messages
   - Steps to reproduce
   - Log outputs

4. **Check System Requirements:**
   - Windows 10 version 2004+ or Windows 11
   - 8GB RAM minimum
   - 20GB free disk space
   - WSL2 enabled
   - Hyper-V enabled