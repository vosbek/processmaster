#!/bin/bash

# ProcessMaster Pro Development Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up ProcessMaster Pro development environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your actual configuration values."
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p database/init
mkdir -p nginx
mkdir -p logs
mkdir -p uploads

# Create database initialization script
cat > database/init/01-init.sql << 'EOF'
-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create initial admin user (for development only)
-- Password: admin123 (hashed)
-- This will be replaced by proper LDAP/OAuth2 authentication
EOF

# Create nginx configuration
cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream web {
        server web:3000;
    }

    upstream api {
        server api:3001;
    }

    server {
        listen 80;
        server_name localhost;

        # Frontend
        location / {
            proxy_pass http://web;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API
        location /api {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket support
        location /ws {
            proxy_pass http://web;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
EOF

# Install dependencies
echo "📦 Installing dependencies..."

# API dependencies
if [ -d "apps/api" ]; then
    echo "Installing API dependencies..."
    cd apps/api
    if [ -f "package.json" ]; then
        npm install
    fi
    cd ../..
fi

# Web dependencies
if [ -d "apps/web" ]; then
    echo "Installing Web dependencies..."
    cd apps/web
    if [ -f "package.json" ]; then
        npm install
    fi
    cd ../..
fi

# Chrome extension dependencies
if [ -d "apps/chrome-extension" ]; then
    echo "Installing Chrome extension dependencies..."
    cd apps/chrome-extension
    if [ -f "package.json" ]; then
        npm install
    fi
    cd ../..
fi

echo "✅ Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update the .env file with your actual configuration values"
echo "2. Start the development environment: ./scripts/dev-start.sh"
echo "3. Visit http://localhost:3000 to access the application"
echo ""
echo "🔧 Available commands:"
echo "- ./scripts/dev-start.sh    - Start development environment"
echo "- ./scripts/dev-stop.sh     - Stop development environment"
echo "- ./scripts/dev-logs.sh     - View logs"
echo "- ./scripts/dev-reset.sh    - Reset development environment"