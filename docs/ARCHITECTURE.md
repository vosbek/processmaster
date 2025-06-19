# ProcessMaster Pro - System Architecture

This document provides a comprehensive overview of the ProcessMaster Pro system architecture, including diagrams, data flows, and technical decisions.

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [System Components](#system-components)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Database Schema](#database-schema)
5. [API Architecture](#api-architecture)
6. [Frontend Architecture](#frontend-architecture)
7. [Security Architecture](#security-architecture)
8. [Deployment Architecture](#deployment-architecture)
9. [Integration Points](#integration-points)

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Web Application<br/>Next.js 14]
        EXT[Chrome Extension<br/>Manifest V3]
        DESK[Desktop App<br/>Electron]
        MOB[Mobile App<br/>React Native]
    end
    
    subgraph "Load Balancer & CDN"
        LB[Application Load Balancer]
        CDN[CloudFront CDN]
    end
    
    subgraph "Application Tier"
        API[API Server<br/>Node.js + Express]
        WS[WebSocket Server<br/>Real-time Updates]
    end
    
    subgraph "AI/ML Services"
        BEDROCK[AWS Bedrock<br/>Claude 3.5 Sonnet v2]
        LAMBDA[Processing Lambda<br/>Image Analysis]
    end
    
    subgraph "Data Tier"
        RDS[(PostgreSQL<br/>Primary Database)]
        S3[(S3 Storage<br/>Files & Assets)]
        REDIS[(Redis<br/>Cache & Sessions)]
    end
    
    subgraph "Authentication"
        LDAP[LDAP Server<br/>Enterprise Auth]
        OAUTH[OAuth2 Provider<br/>SSO Integration]
        JWT[JWT Token Service]
    end
    
    subgraph "Monitoring & Logging"
        CW[CloudWatch<br/>Logs & Metrics]
        SENTRY[Sentry<br/>Error Tracking]
    end
    
    WEB --> LB
    EXT --> LB
    DESK --> LB
    MOB --> LB
    
    LB --> API
    LB --> WS
    CDN --> S3
    
    API --> RDS
    API --> S3
    API --> REDIS
    API --> BEDROCK
    API --> LAMBDA
    API --> JWT
    
    JWT --> LDAP
    JWT --> OAUTH
    
    API --> CW
    WEB --> SENTRY
```

## System Components

### Frontend Applications

#### Web Application (Next.js 14)
```mermaid
graph LR
    subgraph "Next.js Application"
        PAGES[Pages<br/>App Router]
        COMP[Components<br/>React + TypeScript]
        HOOKS[Custom Hooks<br/>State Management]
        API_CLIENT[API Client<br/>HTTP + WebSocket]
    end
    
    subgraph "UI Framework"
        TAILWIND[Tailwind CSS<br/>Styling]
        HEADLESS[Headless UI<br/>Components]
        ICONS[Hero Icons<br/>Icon System]
    end
    
    subgraph "State Management"
        ZUSTAND[Zustand<br/>Global State]
        REACT_QUERY[TanStack Query<br/>Server State]
        FORM[React Hook Form<br/>Form State]
    end
    
    PAGES --> COMP
    COMP --> HOOKS
    HOOKS --> API_CLIENT
    COMP --> TAILWIND
    COMP --> HEADLESS
    COMP --> ICONS
    HOOKS --> ZUSTAND
    HOOKS --> REACT_QUERY
    COMP --> FORM
```

#### Chrome Extension
```mermaid
graph TD
    subgraph "Chrome Extension (Manifest V3)"
        SW[Service Worker<br/>Background Processing]
        CS[Content Scripts<br/>DOM Interaction]
        POPUP[Popup UI<br/>Extension Interface]
        OPTIONS[Options Page<br/>Settings]
    end
    
    subgraph "Capture System"
        SCREEN[Screen Capture API<br/>getDisplayMedia()]
        INTERACT[Interaction Tracking<br/>Mouse/Keyboard Events]
        UPLOAD[Upload Manager<br/>Direct S3 Upload]
    end
    
    SW --> CS
    SW --> POPUP
    SW --> OPTIONS
    CS --> SCREEN
    CS --> INTERACT
    SW --> UPLOAD
```

### Backend Services

#### API Server Architecture
```mermaid
graph TD
    subgraph "Express.js API Server"
        ROUTER[Route Handlers<br/>REST Endpoints]
        MIDDLEWARE[Middleware Stack<br/>Auth, Validation, CORS]
        CONTROLLERS[Controllers<br/>Business Logic]
        SERVICES[Service Layer<br/>Core Operations]
    end
    
    subgraph "Data Access Layer"
        ORM[PostgreSQL Client<br/>Database Operations]
        CACHE[Redis Client<br/>Caching Layer]
        S3_CLIENT[S3 Client<br/>File Operations]
    end
    
    subgraph "External Integrations"
        BEDROCK_CLIENT[Bedrock Client<br/>AI Processing]
        LDAP_CLIENT[LDAP Client<br/>Authentication]
        OAUTH_CLIENT[OAuth2 Client<br/>SSO Integration]
    end
    
    ROUTER --> MIDDLEWARE
    MIDDLEWARE --> CONTROLLERS
    CONTROLLERS --> SERVICES
    SERVICES --> ORM
    SERVICES --> CACHE
    SERVICES --> S3_CLIENT
    SERVICES --> BEDROCK_CLIENT
    SERVICES --> LDAP_CLIENT
    SERVICES --> OAUTH_CLIENT
```

## Data Flow Diagrams

### Screen Capture and Guide Generation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant E as Chrome Extension
    participant API as API Server
    participant S3 as S3 Storage
    participant B as AWS Bedrock
    participant DB as PostgreSQL
    
    U->>E: Start Screen Capture
    E->>API: POST /api/capture/start
    API->>DB: Create capture session
    API-->>E: Session ID & Upload URLs
    
    E->>E: Capture screenshots & interactions
    E->>S3: Upload screenshots (direct)
    E->>API: POST /api/capture/interactions
    API->>DB: Store interaction data
    
    U->>E: Stop Capture
    E->>API: POST /api/capture/stop
    API->>B: Process with Claude 3.5 Sonnet v2
    B-->>API: Generated guide content
    API->>DB: Store guide data
    API-->>E: Processing complete
    
    U->>E: View Generated Guide
    E->>API: GET /api/guides/:id
    API->>DB: Fetch guide data
    API-->>E: Guide content & metadata
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web App
    participant API as API Server
    participant LDAP as LDAP Server
    participant JWT as JWT Service
    participant DB as PostgreSQL
    
    U->>W: Login Request
    W->>API: POST /api/auth/login
    API->>LDAP: Validate credentials
    LDAP-->>API: User attributes
    API->>DB: Check/create user record
    API->>JWT: Generate JWT token
    JWT-->>API: Signed token
    API-->>W: Token + user data
    W->>W: Store token in secure storage
    
    Note over U,DB: Subsequent authenticated requests
    W->>API: Request with Authorization header
    API->>JWT: Verify token
    JWT-->>API: Token payload
    API->>DB: Execute authorized operation
    API-->>W: Response data
```

### File Upload and Processing Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web App
    participant API as API Server
    participant S3 as S3 Storage
    participant CDN as CloudFront
    participant DB as PostgreSQL
    
    U->>W: Select file for upload
    W->>API: POST /api/upload/presigned-url
    API->>S3: Generate presigned URL
    S3-->>API: Signed upload URL
    API-->>W: Upload URL & metadata
    
    W->>S3: PUT file (direct upload)
    S3-->>W: Upload confirmation
    W->>API: POST /api/upload/confirm
    API->>DB: Store file metadata
    API->>CDN: Invalidate cache (if needed)
    API-->>W: File URL & metadata
    
    Note over U,DB: File access
    U->>W: Request file
    W->>CDN: GET file URL
    CDN->>S3: Fetch if not cached
    S3-->>CDN: File content
    CDN-->>W: Cached file
```

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ GUIDES : creates
    USERS ||--o{ CAPTURE_SESSIONS : owns
    USERS ||--o{ USER_TEAMS : belongs_to
    TEAMS ||--o{ USER_TEAMS : has_members
    TEAMS ||--o{ GUIDES : contains
    
    GUIDES ||--o{ GUIDE_STEPS : has
    GUIDES ||--o{ GUIDE_COLLABORATORS : shared_with
    GUIDES ||--o{ GUIDE_VIEWS : viewed_by
    GUIDES ||--o{ GUIDE_EXPORTS : exported_as
    
    CAPTURE_SESSIONS ||--o{ CAPTURE_INTERACTIONS : records
    CAPTURE_SESSIONS ||--o{ CAPTURE_SCREENSHOTS : contains
    
    GUIDE_STEPS ||--o{ STEP_ANNOTATIONS : annotated_with
    
    FILES ||--o{ CAPTURE_SCREENSHOTS : stores
    FILES ||--o{ GUIDE_STEPS : attached_to
    
    USERS {
        uuid id PK
        string email UK
        string firstName
        string lastName
        string passwordHash
        enum role
        jsonb preferences
        timestamp createdAt
        timestamp lastLoginAt
        boolean emailVerified
        boolean isActive
    }
    
    TEAMS {
        uuid id PK
        string name
        text description
        jsonb settings
        timestamp createdAt
        uuid ownerId FK
    }
    
    GUIDES {
        uuid id PK
        string title
        text description
        enum status
        enum visibility
        jsonb metadata
        uuid authorId FK
        uuid teamId FK
        timestamp createdAt
        timestamp updatedAt
    }
    
    CAPTURE_SESSIONS {
        uuid id PK
        string title
        text description
        enum status
        jsonb settings
        jsonb metadata
        uuid userId FK
        timestamp startedAt
        timestamp completedAt
    }
```

### Key Database Tables

#### Core Tables
- **users**: User accounts and profiles
- **teams**: Team/organization management
- **guides**: Process documentation guides
- **capture_sessions**: Screen recording sessions

#### Content Tables
- **guide_steps**: Individual steps within guides
- **step_annotations**: Visual annotations on screenshots
- **capture_interactions**: User interactions during recording
- **capture_screenshots**: Screenshots taken during capture

#### System Tables
- **files**: File metadata and S3 references
- **ai_processing_jobs**: AI processing queue and status
- **audit_logs**: System audit trail
- **api_keys**: API access management

## API Architecture

### REST API Design

```mermaid
graph TD
    subgraph "API Endpoints"
        AUTH[/api/auth/*<br/>Authentication]
        USERS[/api/users/*<br/>User Management]
        TEAMS[/api/teams/*<br/>Team Operations]
        GUIDES[/api/guides/*<br/>Guide CRUD]
        CAPTURE[/api/capture/*<br/>Screen Capture]
        FILES[/api/files/*<br/>File Operations]
        AI[/api/ai/*<br/>AI Processing]
    end
    
    subgraph "Middleware Stack"
        CORS[CORS Handler]
        RATE[Rate Limiting]
        AUTH_MW[Authentication]
        VALID[Validation]
        ERROR[Error Handler]
    end
    
    subgraph "Controllers"
        AUTH_CTRL[AuthController]
        USER_CTRL[UserController]
        TEAM_CTRL[TeamController]
        GUIDE_CTRL[GuideController]
        CAPTURE_CTRL[CaptureController]
        FILE_CTRL[FileController]
        AI_CTRL[AIController]
    end
    
    AUTH --> AUTH_MW
    AUTH_MW --> VALID
    VALID --> AUTH_CTRL
    
    GUIDES --> AUTH_MW
    AUTH_MW --> VALID
    VALID --> GUIDE_CTRL
    
    CAPTURE --> AUTH_MW
    AUTH_MW --> VALID
    VALID --> CAPTURE_CTRL
```

### API Response Standards

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Guide Title",
    "steps": [...]
  },
  "metadata": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "hasNext": true
  },
  "timing": {
    "requestId": "req_123",
    "duration": 150
  }
}
```

## Frontend Architecture

### Component Architecture

```mermaid
graph TD
    subgraph "Application Shell"
        LAYOUT[DashboardLayout<br/>Navigation & Shell]
        AUTH[AuthWrapper<br/>Authentication Guard]
        ERROR[ErrorBoundary<br/>Error Handling]
    end
    
    subgraph "Feature Components"
        GUIDE_LIST[GuidesList<br/>Guide Management]
        GUIDE_EDITOR[GuideEditor<br/>Content Creation]
        GUIDE_VIEWER[GuideViewer<br/>Step Display]
        CAPTURE_UI[CaptureInterface<br/>Recording Controls]
        SETTINGS[UserSettings<br/>Configuration]
    end
    
    subgraph "Shared Components"
        UI_KIT[UI Components<br/>Buttons, Forms, etc.]
        MODAL[Modal System<br/>Overlays & Dialogs]
        UPLOAD[FileUpload<br/>File Handling]
        EDITOR[RichTextEditor<br/>Content Editing]
    end
    
    LAYOUT --> AUTH
    AUTH --> ERROR
    ERROR --> GUIDE_LIST
    ERROR --> GUIDE_EDITOR
    ERROR --> GUIDE_VIEWER
    ERROR --> CAPTURE_UI
    ERROR --> SETTINGS
    
    GUIDE_LIST --> UI_KIT
    GUIDE_EDITOR --> EDITOR
    GUIDE_EDITOR --> UPLOAD
    SETTINGS --> MODAL
```

### State Management Strategy

```mermaid
graph LR
    subgraph "Global State (Zustand)"
        USER[User State<br/>Profile & Auth]
        UI[UI State<br/>Modals & Notifications]
        SETTINGS[Settings State<br/>User Preferences]
    end
    
    subgraph "Server State (TanStack Query)"
        GUIDES[Guides Data<br/>Cached & Synchronized]
        TEAMS[Teams Data<br/>Cached & Synchronized]
        FILES[Files Data<br/>Upload Progress]
    end
    
    subgraph "Local State (useState/useReducer)"
        FORMS[Form State<br/>React Hook Form]
        EDITOR_STATE[Editor State<br/>Content Editing]
        CAPTURE_STATE[Capture State<br/>Recording Status]
    end
    
    USER --> GUIDES
    SETTINGS --> UI
    GUIDES --> FORMS
    FILES --> EDITOR_STATE
```

## Security Architecture

### Authentication & Authorization Flow

```mermaid
graph TD
    subgraph "Authentication Methods"
        LDAP_AUTH[LDAP Authentication<br/>Enterprise Directory]
        OAUTH_AUTH[OAuth2/OIDC<br/>SSO Providers]
        LOCAL_AUTH[Local Authentication<br/>Email/Password]
    end
    
    subgraph "Token Management"
        JWT_SERVICE[JWT Service<br/>Token Generation]
        REFRESH[Refresh Token<br/>Rotation]
        BLACKLIST[Token Blacklist<br/>Revocation]
    end
    
    subgraph "Authorization"
        RBAC[Role-Based Access Control<br/>User Roles]
        TEAM_PERMS[Team Permissions<br/>Resource Access]
        API_AUTHZ[API Authorization<br/>Endpoint Protection]
    end
    
    LDAP_AUTH --> JWT_SERVICE
    OAUTH_AUTH --> JWT_SERVICE
    LOCAL_AUTH --> JWT_SERVICE
    
    JWT_SERVICE --> REFRESH
    REFRESH --> BLACKLIST
    
    JWT_SERVICE --> RBAC
    RBAC --> TEAM_PERMS
    TEAM_PERMS --> API_AUTHZ
```

### Data Protection Layers

```mermaid
graph TB
    subgraph "Transport Security"
        TLS[TLS 1.3<br/>HTTPS/WSS]
        HSTS[HTTP Strict Transport Security]
        PINNING[Certificate Pinning]
    end
    
    subgraph "Application Security"
        CSRF[CSRF Protection<br/>SameSite Cookies]
        XSS[XSS Prevention<br/>Content Security Policy]
        INJECTION[SQL Injection Prevention<br/>Parameterized Queries]
    end
    
    subgraph "Data Security"
        ENCRYPT_REST[Encryption at Rest<br/>RDS & S3]
        ENCRYPT_TRANSIT[Encryption in Transit<br/>TLS]
        KEY_MGMT[Key Management<br/>AWS KMS]
    end
    
    subgraph "Access Controls"
        IAM[AWS IAM<br/>Service Permissions]
        VPC[VPC Security Groups<br/>Network Isolation]
        WAF[Web Application Firewall]
    end
    
    TLS --> CSRF
    HSTS --> XSS
    PINNING --> INJECTION
    
    ENCRYPT_REST --> IAM
    ENCRYPT_TRANSIT --> VPC
    KEY_MGMT --> WAF
```

## Deployment Architecture

### AWS Infrastructure

```mermaid
graph TB
    subgraph "CDN & DNS"
        ROUTE53[Route 53<br/>DNS Management]
        CLOUDFRONT[CloudFront<br/>Global CDN]
        WAF[AWS WAF<br/>Web Application Firewall]
    end
    
    subgraph "Compute"
        ALB[Application Load Balancer<br/>Multi-AZ]
        ECS[ECS Fargate<br/>Container Orchestration]
        LAMBDA[Lambda Functions<br/>Serverless Processing]
    end
    
    subgraph "Storage & Database"
        RDS[RDS PostgreSQL<br/>Multi-AZ with Read Replicas]
        S3[S3 Buckets<br/>File Storage]
        ELASTICACHE[ElastiCache Redis<br/>Session Store]
    end
    
    subgraph "AI & ML"
        BEDROCK[AWS Bedrock<br/>Claude 3.5 Sonnet v2]
        COMPREHEND[Amazon Comprehend<br/>Text Analysis]
        TEXTRACT[Amazon Textract<br/>OCR Processing]
    end
    
    subgraph "Monitoring & Security"
        CLOUDWATCH[CloudWatch<br/>Logs & Metrics]
        SECRETS[Secrets Manager<br/>Credential Storage]
        KMS[AWS KMS<br/>Encryption Keys]
    end
    
    ROUTE53 --> CLOUDFRONT
    CLOUDFRONT --> WAF
    WAF --> ALB
    ALB --> ECS
    ECS --> RDS
    ECS --> S3
    ECS --> ELASTICACHE
    ECS --> BEDROCK
    LAMBDA --> COMPREHEND
    LAMBDA --> TEXTRACT
    ECS --> CLOUDWATCH
    ECS --> SECRETS
    SECRETS --> KMS
```

### Container Architecture

```mermaid
graph TD
    subgraph "ECS Cluster"
        subgraph "API Service"
            API_TASK[API Task Definition<br/>Node.js Container]
            API_LB[Target Group<br/>Health Checks]
        end
        
        subgraph "Web Service"
            WEB_TASK[Web Task Definition<br/>Next.js Container]
            WEB_LB[Target Group<br/>Health Checks]
        end
        
        subgraph "Worker Service"
            WORKER_TASK[Worker Task Definition<br/>Background Jobs]
            QUEUE[SQS Queue<br/>Job Processing]
        end
    end
    
    subgraph "Shared Resources"
        ECR[ECR Repository<br/>Container Registry]
        LOGS[CloudWatch Logs<br/>Centralized Logging]
        CONFIG[Parameter Store<br/>Configuration]
    end
    
    API_TASK --> API_LB
    WEB_TASK --> WEB_LB
    WORKER_TASK --> QUEUE
    
    API_TASK --> ECR
    WEB_TASK --> ECR
    WORKER_TASK --> ECR
    
    API_TASK --> LOGS
    WEB_TASK --> LOGS
    WORKER_TASK --> LOGS
    
    API_TASK --> CONFIG
    WEB_TASK --> CONFIG
    WORKER_TASK --> CONFIG
```

## Integration Points

### External Service Integrations

```mermaid
graph LR
    subgraph "ProcessMaster Pro"
        API[API Server]
        WEB[Web Application]
        EXT[Chrome Extension]
    end
    
    subgraph "AWS Services"
        BEDROCK[AWS Bedrock<br/>AI Processing]
        S3[S3 Storage<br/>File Management]
        RDS[RDS PostgreSQL<br/>Database]
        SES[SES<br/>Email Service]
    end
    
    subgraph "Enterprise Systems"
        LDAP[LDAP/AD<br/>Authentication]
        OAUTH[OAuth2 Providers<br/>SSO Integration]
        SLACK[Slack API<br/>Notifications]
        TEAMS[Microsoft Teams<br/>Integration]
    end
    
    subgraph "Third-Party Tools"
        SENTRY[Sentry<br/>Error Tracking]
        ANALYTICS[Analytics<br/>Usage Tracking]
        MONITORING[DataDog/NewRelic<br/>Performance Monitoring]
    end
    
    API --> BEDROCK
    API --> S3
    API --> RDS
    API --> SES
    API --> LDAP
    API --> OAUTH
    API --> SLACK
    API --> TEAMS
    
    WEB --> SENTRY
    WEB --> ANALYTICS
    API --> MONITORING
```

### Webhook and Event System

```mermaid
sequenceDiagram
    participant API as API Server
    participant QUEUE as Event Queue
    participant WEBHOOK as Webhook Service
    participant EXTERNAL as External System
    participant NOTIFICATION as Notification Service
    
    Note over API,NOTIFICATION: Event-Driven Architecture
    
    API->>QUEUE: Publish Event (Guide Created)
    QUEUE->>WEBHOOK: Process Webhook Events
    WEBHOOK->>EXTERNAL: POST /webhook/guide-created
    EXTERNAL-->>WEBHOOK: 200 OK
    
    QUEUE->>NOTIFICATION: Process Notification Events
    NOTIFICATION->>NOTIFICATION: Generate Notification
    NOTIFICATION->>API: Send Email/Slack/Teams
    
    Note over API,NOTIFICATION: Retry & Dead Letter Handling
    WEBHOOK->>WEBHOOK: Retry Failed Webhooks
    WEBHOOK->>QUEUE: Dead Letter Queue (Max Retries)
```

## Performance Considerations

### Caching Strategy

```mermaid
graph TD
    subgraph "Frontend Caching"
        BROWSER[Browser Cache<br/>Static Assets]
        SW_CACHE[Service Worker<br/>Offline Support]
        QUERY_CACHE[TanStack Query<br/>API Response Cache]
    end
    
    subgraph "CDN Caching"
        CLOUDFRONT_CACHE[CloudFront<br/>Global Edge Cache]
        S3_CACHE[S3 Transfer Acceleration<br/>File Upload/Download]
    end
    
    subgraph "Application Caching"
        REDIS_CACHE[Redis Cache<br/>Session & Data Cache]
        API_CACHE[API Response Cache<br/>Short-term Caching]
        DB_CACHE[Connection Pool<br/>Database Connections]
    end
    
    BROWSER --> CLOUDFRONT_CACHE
    SW_CACHE --> CLOUDFRONT_CACHE
    QUERY_CACHE --> API_CACHE
    CLOUDFRONT_CACHE --> S3_CACHE
    API_CACHE --> REDIS_CACHE
    REDIS_CACHE --> DB_CACHE
```

### Scaling Strategy

```mermaid
graph TB
    subgraph "Horizontal Scaling"
        ALB[Application Load Balancer]
        ASG[Auto Scaling Group<br/>ECS Services]
        RDS_READ[Read Replicas<br/>Database Scaling]
    end
    
    subgraph "Vertical Scaling"
        COMPUTE[Compute Optimization<br/>CPU/Memory Scaling]
        STORAGE[Storage Optimization<br/>IOPS & Throughput]
        NETWORK[Network Optimization<br/>Enhanced Networking]
    end
    
    subgraph "Performance Monitoring"
        METRICS[CloudWatch Metrics<br/>CPU, Memory, Network]
        ALARMS[CloudWatch Alarms<br/>Auto Scaling Triggers]
        APM[Application Performance<br/>Response Time Monitoring]
    end
    
    ALB --> ASG
    ASG --> RDS_READ
    COMPUTE --> STORAGE
    STORAGE --> NETWORK
    METRICS --> ALARMS
    ALARMS --> APM
```

This architecture documentation provides a comprehensive view of the ProcessMaster Pro system, from high-level component interactions to detailed technical implementations. It serves as a reference for development, deployment, and maintenance activities.