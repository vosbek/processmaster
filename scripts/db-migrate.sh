#!/bin/bash

# ProcessMaster Pro Database Migration Script
# Runs database migrations

set -e

echo "🗄️  Running database migrations..."

# Check if database is running
if ! docker exec processmaster-db pg_isready -U processmaster -d processmaster_pro &> /dev/null; then
    echo "❌ Database is not running. Please start the development environment first."
    echo "Run: ./scripts/dev-start.sh"
    exit 1
fi

# Run migrations through the API container
if docker ps | grep -q processmaster-api; then
    echo "Running migrations through API container..."
    docker exec processmaster-api npm run migrate
else
    echo "API container not running. Starting migration directly..."
    
    # Load environment variables
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    # Run migration from apps/api directory
    cd apps/api
    npm run migrate
    cd ../..
fi

echo "✅ Database migrations completed!"