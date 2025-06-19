# ProcessMaster Pro

> Enterprise-grade AI-powered process documentation platform

ProcessMaster Pro is a comprehensive solution for automatically generating professional step-by-step guides from screen recordings. Built with AWS-native architecture and powered by Claude 3.5 Sonnet v2, it delivers enterprise-grade security, scalability, and AI capabilities.

## 🌟 Features

- **🎥 Smart Screen Capture**: Multi-platform recording (web, desktop, mobile)
- **🤖 AI-Powered Generation**: Automatic step-by-step instruction creation
- **🔒 Enterprise Security**: LDAP/OAuth2 authentication, SOC 2 compliance, end-to-end encryption
- **🌐 Multi-Platform**: Browser extensions, desktop apps, web application
- **📊 Advanced Analytics**: Usage insights and performance metrics
- **🔄 Real-time Collaboration**: Team editing with version control
- **📤 Multiple Export Formats**: PDF, HTML, Video, DOCX with custom branding

## 🏗️ Architecture

### AWS Infrastructure
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │────│   S3 Bucket     │────│   ECS Fargate   │
│   (CDN/Assets)  │    │   (Screenshots) │    │   (Backend API) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │────│  AWS Bedrock    │────│  RDS PostgreSQL │
│   (REST/WS)     │    │  (Claude 3.5v2) │    │  (Database)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Application Stack
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Desktop**: Electron (Windows, macOS, Linux)
- **Browser Extensions**: Manifest V3 (Chrome, Firefox, Edge, Safari)
- **Mobile**: React Native (iOS, Android)
- **AI/ML**: AWS Bedrock with Claude 3.5 Sonnet v2
- **Database**: PostgreSQL (no Redis for now)
- **Storage**: AWS S3 + CloudFront CDN
- **Authentication**: LDAP/OAuth2 (enterprise-ready)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with appropriate permissions
- Docker and Docker Compose
- PostgreSQL (local or RDS)

### 1. Clone Repository
```bash
git clone https://github.com/your-org/processmaster-pro.git
cd processmaster-pro
```

### 2. Environment Setup
```bash
# Copy environment templates
cp .env.example .env.local
cp .env.docker.example .env.docker

# Install dependencies
npm install
```

### 3. Configure Environment Variables
```bash
# .env.local
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

DATABASE_URL=postgresql://user:password@localhost:5432/processmaster
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# LDAP/OAuth2 Configuration (enterprise)
LDAP_SERVER_URL=ldap://your-ldap-server.com:389
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=your_ldap_password
LDAP_SEARCH_BASE=ou=users,dc=company,dc=com

OAUTH2_CLIENT_ID=your_oauth2_client_id
OAUTH2_CLIENT_SECRET=your_oauth2_client_secret
OAUTH2_ISSUER_URL=https://your-oauth-provider.com

S3_BUCKET_NAME=processmaster-assets
CLOUDFRONT_DISTRIBUTION_ID=your_distribution_id
```

### 4. Database Setup
```bash
# Start PostgreSQL (if using Docker)
docker-compose up -d postgres

# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed
```

### 5. Start Development Servers
```bash
# Start all services
npm run dev

# Or start individually
npm run dev:web      # Next.js frontend (port 3000)
npm run dev:api      # Express backend (port 3001)
npm run dev:desktop  # Electron app
```

## 🛠️ Development

### Project Structure
```
processmaster-pro/
├── apps/
│   ├── web/                 # Next.js web application
│   ├── api/                 # Express.js backend API
│   ├── desktop/             # Electron desktop application
│   └── mobile/              # React Native mobile app
├── packages/
│   ├── ui/                  # Shared UI components
│   ├── shared/              # Shared utilities and types
│   ├── database/            # Database schemas and migrations
│   └── extensions/          # Browser extensions
├── infrastructure/
│   ├── aws/                 # AWS CDK/CloudFormation templates
│   ├── docker/              # Docker configurations
│   └── k8s/                 # Kubernetes manifests
├── docs/                    # Documentation
└── scripts/                 # Build and deployment scripts
```

### Available Scripts

#### Development
```bash
npm run dev                  # Start all development servers
npm run dev:web             # Start Next.js frontend only
npm run dev:api             # Start Express backend only
npm run dev:desktop         # Start Electron app
npm run dev:mobile          # Start React Native with Expo
```

#### Building
```bash
npm run build               # Build all applications
npm run build:web           # Build Next.js application
npm run build:api           # Build Express backend
npm run build:desktop       # Build Electron distributables
npm run build:extensions    # Build browser extensions
```

#### Testing
```bash
npm run test                # Run all tests
npm run test:unit           # Run unit tests
npm run test:integration    # Run integration tests
npm run test:e2e            # Run end-to-end tests
npm run test:coverage       # Generate test coverage report
```

#### Database
```bash
npm run db:migrate          # Run database migrations
npm run db:rollback         # Rollback last migration
npm run db:seed             # Seed development data
npm run db:reset            # Reset database (dev only)
```

#### Linting & Formatting
```bash
npm run lint                # Lint all code
npm run lint:fix            # Fix linting issues
npm run format              # Format code with Prettier
npm run typecheck           # Run TypeScript type checking
```

### Browser Extension Development

#### Chrome Extension
```bash
cd packages/extensions/chrome
npm run build:dev           # Development build
npm run build:prod          # Production build

# Load in Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the dist/ folder
```

#### Firefox Extension
```bash
cd packages/extensions/firefox
npm run build:dev
npm run build:prod

# Load in Firefox:
# 1. Go to about:debugging
# 2. Click "This Firefox"
# 3. Click "Load Temporary Add-on"
# 4. Select manifest.json from dist/
```

### Desktop Application Development

#### Electron Setup
```bash
cd apps/desktop
npm install

# Development
npm run electron:dev        # Start with hot reload

# Building
npm run electron:build      # Build for current platform
npm run electron:build:all  # Build for all platforms
npm run electron:pack       # Create distribution packages
```

#### Platform-specific Commands
```bash
# Windows
npm run electron:build:win

# macOS
npm run electron:build:mac

# Linux
npm run electron:build:linux
```

## 🧪 Testing

### Unit Tests
```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:unit:coverage

# Watch mode
npm run test:unit:watch
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Test specific module
npm run test:integration -- --grep "AI Processing"
```

### End-to-End Tests
```bash
# Run E2E tests (requires running application)
npm run test:e2e

# Run specific test suite
npm run test:e2e:web        # Web application tests
npm run test:e2e:desktop    # Desktop application tests
npm run test:e2e:extensions # Browser extension tests
```

### AI/ML Testing
```bash
# Test AI model responses
npm run test:ai

# Benchmark AI performance
npm run benchmark:ai

# Test with different model versions
npm run test:ai:models
```

## 🚀 Deployment

### Development Environment
```bash
# Deploy to AWS development environment
npm run deploy:dev

# Deploy specific service
npm run deploy:dev:api
npm run deploy:dev:web
```

### Staging Environment
```bash
# Deploy to staging
npm run deploy:staging

# Run staging tests
npm run test:staging
```

### Production Environment
```bash
# Deploy to production (requires approval)
npm run deploy:prod

# Blue-green deployment
npm run deploy:prod:blue-green

# Rollback deployment
npm run deploy:rollback
```

### Infrastructure as Code
```bash
# Deploy AWS infrastructure
npm run infra:deploy

# Update infrastructure
npm run infra:update

# Destroy infrastructure (dev only)
npm run infra:destroy
```

## 🔐 Security & Authentication

### LDAP/OAuth2 Configuration
The application supports enterprise authentication through LDAP and OAuth2 providers:

**LDAP Integration:**
- Active Directory compatibility
- Group-based role mapping
- Secure LDAP (LDAPS) support
- Connection pooling for performance

**OAuth2 Support:**
- OpenID Connect (OIDC) compliance
- Support for major providers (Azure AD, Google, Okta)
- PKCE for enhanced security
- Refresh token rotation

### Environment Variables
Never commit sensitive information. Use the following for different environments:

**Development**: `.env.local`
**Testing**: `.env.test`
**Production**: AWS Parameter Store/Secrets Manager

### AWS Permissions
Required AWS permissions for development:
- **Bedrock**: `bedrock:InvokeModel`
- **S3**: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`
- **RDS**: Database connection permissions
- **CloudFront**: Cache invalidation permissions

### Security Best Practices
- All API endpoints require authentication
- Sensitive data is encrypted at rest and in transit
- Regular security audits and dependency updates
- OWASP security guidelines compliance

## 📊 Monitoring & Analytics

### Application Monitoring
```bash
# Start monitoring dashboard
npm run monitor:dev

# View logs
npm run logs:api
npm run logs:web
```

### AWS CloudWatch Integration
- Custom metrics for AI processing performance
- Error tracking and alerting
- Usage analytics and billing monitoring

### Performance Monitoring
- Core Web Vitals tracking
- API response time monitoring
- Database query performance
- AI model latency tracking

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm run test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Standards
- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration with custom rules
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for linting and testing
- **Conventional Commits**: Standardized commit messages

### Pull Request Guidelines
- Include comprehensive tests for new features
- Update documentation for any API changes
- Ensure all tests pass and coverage remains above 80%
- Add screenshots for UI changes
- Include performance impact analysis for significant changes

## 📚 API Documentation

### REST API
- **Base URL**: `https://api.processmaster.pro/v1`
- **Authentication**: Bearer token (JWT)
- **Rate Limiting**: 1000 requests/hour per user

#### Key Endpoints
```bash
GET    /api/v1/guides              # List user's guides
POST   /api/v1/guides              # Create new guide
GET    /api/v1/guides/:id          # Get specific guide
PUT    /api/v1/guides/:id          # Update guide
DELETE /api/v1/guides/:id          # Delete guide

POST   /api/v1/capture/start       # Start screen capture session
POST   /api/v1/capture/stop        # Stop capture and process
GET    /api/v1/capture/:id/status  # Check processing status

POST   /api/v1/ai/analyze          # Analyze screenshots with AI
POST   /api/v1/ai/generate         # Generate instructions
```

### WebSocket API
```bash
# Real-time collaboration
wss://api.processmaster.pro/v1/ws

# Events
- guide:update                     # Guide content changed
- capture:progress                 # Capture processing progress
- ai:processing                    # AI analysis status
```

### GraphQL API
```bash
# GraphQL endpoint
POST /api/v1/graphql

# GraphQL Playground (dev only)
GET /api/v1/graphql/playground
```

## 🔧 Troubleshooting

### Common Issues

#### 1. AWS Bedrock Access Denied
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify Bedrock permissions
aws bedrock list-foundation-models --region us-east-1
```

#### 2. Database Connection Issues
```bash
# Check PostgreSQL connection
npm run db:test-connection

# Reset database (dev only)
npm run db:reset
```

#### 3. Browser Extension Not Loading
```bash
# Rebuild extension
npm run build:extensions

# Check manifest version compatibility
# Chrome: Manifest V3
# Firefox: Manifest V2/V3
```

#### 4. Electron App Won't Start
```bash
# Clear Electron cache
npm run electron:clear-cache

# Rebuild native dependencies
npm run electron:rebuild
```

### Performance Issues

#### High Memory Usage
- Check AI model memory consumption
- Monitor PostgreSQL connection pool
- Review image processing pipeline

#### Slow AI Processing
- Verify AWS Bedrock quota limits
- Check image optimization settings
- Monitor Claude model performance

### Debugging

#### Enable Debug Logs
```bash
# Frontend debugging
DEBUG=processmaster:* npm run dev:web

# Backend API debugging
DEBUG=api:* npm run dev:api

# Electron debugging
DEBUG=electron:* npm run dev:desktop
```

#### Useful Debug Commands
```bash
# Check system resources
npm run debug:system

# Analyze bundle size
npm run analyze:bundle

# Test AI model performance
npm run debug:ai-performance
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [https://docs.processmaster.pro](https://docs.processmaster.pro)
- **Issues**: [https://github.com/your-org/processmaster-pro/issues](https://github.com/your-org/processmaster-pro/issues)
- **Discussions**: [https://github.com/your-org/processmaster-pro/discussions](https://github.com/your-org/processmaster-pro/discussions)
- **Email**: support@processmaster.pro
- **Slack**: [ProcessMaster Community](https://join.slack.com/processmaster)

## ✅ Current Status

### Completed Core Features
- [x] **Database System** - PostgreSQL schema with 18 tables, migrations, and connection management
- [x] **Chrome Extension** - Complete screen capture with interaction tracking and popup UI
- [x] **Backend API** - Authentication, capture management, guide CRUD, and AI processing
- [x] **AI Integration** - AWS Bedrock with Claude 3.5 Sonnet v2 for automatic guide generation
- [x] **Authentication System** - JWT tokens, LDAP/OAuth2 support, role-based access control
- [x] **Frontend Dashboard** - Professional React interface with responsive design
- [x] **Authentication Pages** - Login/register with enterprise SSO integration (LDAP, Azure AD, Google, Okta)
- [x] **Landing Page** - Professional marketing site with feature highlights

### In Progress
- [ ] **Guide Management Interface** - List, filter, search, and organize guides
- [ ] **Guide Viewing Interface** - Step-by-step guide display with screenshots

### Next Up
- [ ] **Guide Editing** - Rich text editor for creating and modifying guides
- [ ] **S3 Integration** - File storage for screenshots and document exports
- [ ] **Capture Sessions** - UI for managing and monitoring capture sessions
- [ ] **User Management** - Profile settings and team administration

## 🎯 Roadmap

### Q1 2024 (Current)
- [x] MVP backend with AI-powered guide generation ✅
- [x] Chrome extension with screen capture ✅
- [ ] Frontend dashboard and authentication
- [ ] File storage and export functionality

### Q2 2024
- [ ] Desktop applications (Windows, macOS, Linux)
- [ ] Advanced AI features and content enhancement
- [ ] Team collaboration and real-time editing
- [ ] Advanced export options (PDF, Video, DOCX)

### Q3 2024
- [ ] Mobile companion apps
- [ ] Third-party integrations (Slack, Teams, Confluence)
- [ ] Advanced analytics and reporting
- [ ] Enterprise admin dashboard

### Q4 2024
- [ ] White-label solutions for partners
- [ ] Advanced workflow automation
- [ ] Custom AI model training
- [ ] Global expansion and localization

---

**Built with ❤️ by the ProcessMaster team**