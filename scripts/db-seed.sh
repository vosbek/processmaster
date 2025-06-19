#!/bin/bash

# ProcessMaster Pro Database Seeding Script
# Seeds the database with sample data for development

set -e

echo "🌱 Seeding database with sample data..."

# Check if database is running
if ! docker exec processmaster-db pg_isready -U processmaster -d processmaster_pro &> /dev/null; then
    echo "❌ Database is not running. Please start the development environment first."
    echo "Run: ./scripts/dev-start.sh"
    exit 1
fi

# Run seeding through the API container
if docker ps | grep -q processmaster-api; then
    echo "Running seeding through API container..."
    docker exec processmaster-api npm run seed
else
    echo "API container not running. Starting seeding directly..."
    
    # Load environment variables
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    # Run seeding from apps/api directory
    cd apps/api
    npm run seed
    cd ../..
fi

echo "✅ Database seeding completed!"
echo ""
echo "👤 Sample accounts created:"
echo "- Admin: admin@processmaster.pro / admin123"
echo "- User: user@processmaster.pro / user123"
echo ""
echo "📚 Sample guides and data have been created for testing."