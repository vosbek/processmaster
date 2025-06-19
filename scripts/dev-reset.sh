#!/bin/bash

# ProcessMaster Pro Development Reset Script
# Resets the development environment (removes all data)

set -e

echo "⚠️  WARNING: This will remove all data and reset the development environment!"
echo "This includes:"
echo "- All database data"
echo "- All uploaded files"
echo "- All Redis cache"
echo "- All Docker containers and volumes"
echo ""
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Reset cancelled."
    exit 1
fi

echo "🧹 Resetting development environment..."

# Stop and remove containers, networks, and volumes
if command -v docker-compose &> /dev/null; then
    docker-compose down -v --remove-orphans
else
    docker compose down -v --remove-orphans
fi

# Remove any dangling images
echo "🗑️  Cleaning up Docker images..."
docker image prune -f

# Remove uploads directory
if [ -d "uploads" ]; then
    echo "🗑️  Removing uploads directory..."
    rm -rf uploads
fi

# Remove logs directory
if [ -d "logs" ]; then
    echo "🗑️  Removing logs directory..."
    rm -rf logs
fi

echo "✅ Development environment reset complete!"
echo ""
echo "📋 To set up again:"
echo "1. Run: ./scripts/dev-setup.sh"
echo "2. Run: ./scripts/dev-start.sh"