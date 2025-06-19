#!/bin/bash

# ProcessMaster Pro Development Start Script
# Starts the development environment using Docker Compose

set -e

echo "🚀 Starting ProcessMaster Pro development environment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run ./scripts/dev-setup.sh first."
    exit 1
fi

# Start services with Docker Compose
echo "🐳 Starting Docker containers..."

# Use docker-compose if available, otherwise use docker compose
if command -v docker-compose &> /dev/null; then
    docker-compose up -d
else
    docker compose up -d
fi

echo "⏳ Waiting for services to be ready..."

# Wait for database to be ready
echo "Waiting for database..."
while ! docker exec processmaster-db pg_isready -U processmaster -d processmaster_pro &> /dev/null; do
    sleep 2
done

echo "Waiting for API..."
while ! curl -f http://localhost:3001/health &> /dev/null; do
    sleep 2
done

echo "Waiting for Web app..."
while ! curl -f http://localhost:3000 &> /dev/null; do
    sleep 2
done

echo "✅ Development environment is ready!"
echo ""
echo "🌐 Application URLs:"
echo "- Web App:     http://localhost:3000"
echo "- API:         http://localhost:3001"
echo "- Database:    localhost:5432"
echo "- Redis:       localhost:6379"
echo ""
echo "📋 Useful commands:"
echo "- View logs:   ./scripts/dev-logs.sh"
echo "- Stop:        ./scripts/dev-stop.sh"
echo "- Reset:       ./scripts/dev-reset.sh"