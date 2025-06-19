# ProcessMaster Pro Development Makefile
# Provides convenient commands for development tasks

.PHONY: help setup start stop logs reset clean install test build deploy

# Default target
help: ## Show this help message
	@echo "ProcessMaster Pro Development Commands"
	@echo "======================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development Environment
setup: ## Set up the development environment
	@chmod +x scripts/*.sh
	@./scripts/dev-setup.sh

start: ## Start the development environment
	@./scripts/dev-start.sh

stop: ## Stop the development environment
	@./scripts/dev-stop.sh

restart: stop start ## Restart the development environment

logs: ## View logs from all services
	@./scripts/dev-logs.sh

logs-web: ## View web app logs
	@./scripts/dev-logs.sh web

logs-api: ## View API logs
	@./scripts/dev-logs.sh api

logs-db: ## View database logs
	@./scripts/dev-logs.sh db

reset: ## Reset the development environment (removes all data)
	@./scripts/dev-reset.sh

# Database Operations
migrate: ## Run database migrations
	@./scripts/db-migrate.sh

seed: ## Seed database with sample data
	@./scripts/db-seed.sh

db-shell: ## Connect to database shell
	@docker exec -it processmaster-db psql -U processmaster -d processmaster_pro

# Development Tasks
install: ## Install dependencies for all apps
	@echo "Installing dependencies..."
	@cd apps/api && npm install
	@cd apps/web && npm install
	@if [ -d "apps/chrome-extension" ]; then cd apps/chrome-extension && npm install; fi

clean: ## Clean node_modules and build artifacts
	@echo "Cleaning build artifacts..."
	@find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
	@find . -name ".next" -type d -exec rm -rf {} + 2>/dev/null || true
	@find . -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
	@find . -name "build" -type d -exec rm -rf {} + 2>/dev/null || true

# Testing
test: ## Run all tests
	@echo "Running tests..."
	@cd apps/api && npm test
	@cd apps/web && npm test

test-api: ## Run API tests
	@cd apps/api && npm test

test-web: ## Run web app tests
	@cd apps/web && npm test

test-e2e: ## Run end-to-end tests
	@cd apps/web && npm run test:e2e

# Linting and Formatting
lint: ## Run linting for all apps
	@echo "Running linting..."
	@cd apps/api && npm run lint
	@cd apps/web && npm run lint

lint-fix: ## Fix linting issues
	@echo "Fixing linting issues..."
	@cd apps/api && npm run lint:fix
	@cd apps/web && npm run lint:fix

format: ## Format code with Prettier
	@echo "Formatting code..."
	@cd apps/api && npm run format
	@cd apps/web && npm run format

# Building
build: ## Build all applications
	@echo "Building applications..."
	@cd apps/api && npm run build
	@cd apps/web && npm run build

build-api: ## Build API
	@cd apps/api && npm run build

build-web: ## Build web app
	@cd apps/web && npm run build

# Chrome Extension
ext-build: ## Build Chrome extension
	@if [ -d "apps/chrome-extension" ]; then cd apps/chrome-extension && npm run build; fi

ext-package: ## Package Chrome extension for distribution
	@if [ -d "apps/chrome-extension" ]; then cd apps/chrome-extension && npm run package; fi

# Docker Operations
docker-build: ## Build Docker images
	@docker-compose build

docker-pull: ## Pull latest Docker images
	@docker-compose pull

docker-clean: ## Clean Docker containers and images
	@docker system prune -f
	@docker volume prune -f

# Production
deploy-staging: ## Deploy to staging environment
	@echo "Deploying to staging..."
	@# Add staging deployment commands here

deploy-production: ## Deploy to production environment
	@echo "Deploying to production..."
	@# Add production deployment commands here

# Utilities
shell-api: ## Open shell in API container
	@docker exec -it processmaster-api sh

shell-web: ## Open shell in web container
	@docker exec -it processmaster-web sh

shell-db: ## Open shell in database container
	@docker exec -it processmaster-db sh

backup-db: ## Backup database
	@mkdir -p backups
	@docker exec processmaster-db pg_dump -U processmaster processmaster_pro > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Database backed up to backups/ directory"

restore-db: ## Restore database from backup (Usage: make restore-db FILE=backup.sql)
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore-db FILE=backup.sql"; exit 1; fi
	@docker exec -i processmaster-db psql -U processmaster -d processmaster_pro < $(FILE)
	@echo "Database restored from $(FILE)"

# Health Checks
health: ## Check health of all services
	@echo "Checking service health..."
	@curl -f http://localhost:3000 >/dev/null 2>&1 && echo "✅ Web app is healthy" || echo "❌ Web app is down"
	@curl -f http://localhost:3001/health >/dev/null 2>&1 && echo "✅ API is healthy" || echo "❌ API is down"
	@docker exec processmaster-db pg_isready -U processmaster -d processmaster_pro >/dev/null 2>&1 && echo "✅ Database is healthy" || echo "❌ Database is down"

# Documentation
docs: ## Generate API documentation
	@cd apps/api && npm run docs

docs-serve: ## Serve API documentation
	@cd apps/api && npm run docs:serve