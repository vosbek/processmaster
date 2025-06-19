# ProcessMaster Pro Development Guide

This guide covers everything you need to know to set up and develop ProcessMaster Pro locally.

## Prerequisites

- **Docker & Docker Compose**: For containerized development
- **Node.js 18+**: For local development (optional with Docker)
- **Git**: For version control
- **Chrome Browser**: For testing the Chrome extension

## Quick Start

### 1. Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd processmaster-pro

# Set up the development environment
make setup
# OR
./scripts/dev-setup.sh
```

### 2. Configure Environment

```bash
# Copy and edit environment variables
cp .env.example .env
# Edit .env with your actual configuration values
```

### 3. Start Development Environment

```bash
# Start all services
make start
# OR
./scripts/dev-start.sh
```

### 4. Access the Application

- **Web App**: http://localhost:3000
- **API**: http://localhost:3001
- **Database**: localhost:5432
- **Redis**: localhost:6379

## Development Commands

### Using Make (Recommended)

```bash
make help              # Show all available commands
make setup             # Initial setup
make start             # Start development environment
make stop              # Stop development environment
make restart           # Restart development environment
make logs              # View all logs
make logs-api          # View API logs only
make logs-web          # View web app logs only
make reset             # Reset everything (removes data)
```

### Using Scripts Directly

```bash
./scripts/dev-setup.sh    # Initial setup
./scripts/dev-start.sh    # Start development
./scripts/dev-stop.sh     # Stop development
./scripts/dev-logs.sh     # View logs
./scripts/dev-reset.sh    # Reset environment
```

## Database Operations

### Migrations

```bash
make migrate           # Run database migrations
./scripts/db-migrate.sh
```

### Seeding

```bash
make seed              # Add sample data
./scripts/db-seed.sh
```

### Database Access

```bash
make db-shell          # Connect to database
make backup-db         # Create database backup
make restore-db FILE=backup.sql  # Restore from backup
```

## Development Workflow

### 1. Making Changes

- **API Changes**: Edit files in `apps/api/src/`
- **Web Changes**: Edit files in `apps/web/src/`
- **Extension Changes**: Edit files in `apps/chrome-extension/`

Changes are automatically reloaded in development mode.

### 2. Testing

```bash
make test              # Run all tests
make test-api          # Run API tests only
make test-web          # Run web app tests only
make test-e2e          # Run end-to-end tests
```

### 3. Code Quality

```bash
make lint              # Check code style
make lint-fix          # Fix linting issues
make format            # Format code with Prettier
```

### 4. Building

```bash
make build             # Build all apps
make build-api         # Build API only
make build-web         # Build web app only
```

## Docker Development

### Container Management

```bash
# View running containers
docker ps

# Access container shell
make shell-api         # API container shell
make shell-web         # Web container shell
make shell-db          # Database container shell

# View container logs
docker logs processmaster-api
docker logs processmaster-web
docker logs processmaster-db
```

### Rebuilding Images

```bash
make docker-build      # Rebuild all images
docker-compose build api  # Rebuild specific service
```

## Chrome Extension Development

### Building the Extension

```bash
make ext-build         # Build extension
make ext-package       # Package for distribution
```

### Loading in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `apps/chrome-extension/dist` folder

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://processmaster:dev_password_123@localhost:5432/processmaster_pro

# JWT Authentication
JWT_SECRET=your_jwt_secret_here

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your-s3-bucket

# Bedrock AI
AWS_BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

### Optional Configuration

- **LDAP/OAuth2**: For enterprise authentication
- **SMTP**: For email notifications
- **Redis**: For caching (included in Docker setup)

## Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check Docker is running
docker --version
docker-compose --version

# Check for port conflicts
netstat -tulpn | grep :3000
netstat -tulpn | grep :3001
netstat -tulpn | grep :5432
```

#### Database Connection Issues

```bash
# Check database status
make health
docker exec processmaster-db pg_isready -U processmaster

# Reset database
make reset
make setup
make start
```

#### Permission Issues (Linux/Mac)

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Fix file permissions
sudo chown -R $USER:$USER .
```

### Health Checks

```bash
make health            # Check all services
curl http://localhost:3000  # Web app
curl http://localhost:3001/health  # API health
```

### Logs and Debugging

```bash
make logs              # All service logs
make logs-api          # API logs only
make logs-web          # Web app logs only
make logs-db           # Database logs only

# Follow logs in real-time
docker-compose logs -f api
```

## File Structure

```
processmaster-pro/
├── apps/
│   ├── api/           # Backend API
│   ├── web/           # Frontend web app
│   └── chrome-extension/  # Chrome extension
├── database/
│   └── init/          # Database initialization
├── scripts/           # Development scripts
├── nginx/             # NGINX configuration
├── docker-compose.yml     # Main Docker config
├── docker-compose.override.yml  # Development overrides
├── docker-compose.prod.yml      # Production config
├── Makefile           # Development commands
└── .env.example       # Environment template
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `make test`
4. Check code quality: `make lint`
5. Build to ensure no errors: `make build`
6. Submit a pull request

## Performance Tips

### Development Performance

- Use `make start` instead of `npm run dev` for multiple services
- Keep Docker containers running between sessions
- Use volume mounts for hot reloading

### Database Performance

- Use indexes for frequently queried fields
- Monitor query performance with `EXPLAIN ANALYZE`
- Consider connection pooling for high load

### Frontend Performance

- Use Next.js built-in optimizations
- Optimize images and assets
- Implement proper caching strategies

## Security Considerations

### Development Security

- Never commit `.env` files
- Use development-only secrets locally
- Keep dependencies updated
- Use HTTPS in production

### Production Security

- Use strong passwords and secrets
- Enable CORS properly
- Implement rate limiting
- Use HTTPS everywhere
- Regular security audits

## Deployment

### Staging Deployment

```bash
make deploy-staging
```

### Production Deployment

```bash
make deploy-production
```

See the deployment documentation for detailed instructions.

## Support

- **Issues**: Create GitHub issues for bugs
- **Documentation**: Check the `/docs` directory
- **API Docs**: Run `make docs` to generate API documentation