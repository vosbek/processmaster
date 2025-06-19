#!/bin/bash

# ProcessMaster Pro Development Stop Script
# Stops the development environment

set -e

echo "🛑 Stopping ProcessMaster Pro development environment..."

# Stop services with Docker Compose
if command -v docker-compose &> /dev/null; then
    docker-compose down
else
    docker compose down
fi

echo "✅ Development environment stopped!"
echo ""
echo "💡 To start again, run: ./scripts/dev-start.sh"
echo "💡 To reset everything, run: ./scripts/dev-reset.sh"