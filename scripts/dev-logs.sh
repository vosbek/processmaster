#!/bin/bash

# ProcessMaster Pro Development Logs Script
# View logs from development containers

set -e

# Default to showing all logs
SERVICE=${1:-""}

if [ -z "$SERVICE" ]; then
    echo "📋 Showing logs for all services..."
    echo "Use './scripts/dev-logs.sh <service>' to view specific service logs"
    echo "Available services: web, api, db, redis, nginx"
    echo ""
    
    if command -v docker-compose &> /dev/null; then
        docker-compose logs -f --tail=100
    else
        docker compose logs -f --tail=100
    fi
else
    echo "📋 Showing logs for service: $SERVICE"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose logs -f --tail=100 "$SERVICE"
    else
        docker compose logs -f --tail=100 "$SERVICE"
    fi
fi