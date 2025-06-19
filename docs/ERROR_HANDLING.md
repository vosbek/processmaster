# ProcessMaster Pro - Error Handling Guide

This guide covers the comprehensive error handling system implemented throughout ProcessMaster Pro.

## Overview

ProcessMaster Pro implements a multi-layered error handling strategy that provides:

- **Graceful degradation** for users
- **Detailed logging** for developers
- **Automatic recovery** where possible
- **Clear error messages** with actionable solutions
- **Consistent error formats** across all APIs

## Backend Error Handling

### Error Middleware

The application uses a centralized error handling middleware (`apps/api/src/middleware/errorHandler.ts`) that:

- **Categorizes errors** by type and severity
- **Generates unique error IDs** for tracking
- **Logs comprehensive context** for debugging
- **Returns user-friendly messages** in production
- **Handles different error types** appropriately

#### Error Types Handled

1. **Database Errors** (PostgreSQL)
   - Unique constraint violations → 409 Conflict
   - Foreign key violations → 400 Bad Request
   - Not null violations → 400 Bad Request

2. **Validation Errors** (Zod)
   - Input validation failures → 400 Bad Request
   - Field-specific error messages
   - Detailed validation feedback

3. **Authentication Errors** (JWT)
   - Invalid tokens → 401 Unauthorized
   - Expired tokens → 401 Unauthorized
   - Missing tokens → 401 Unauthorized

4. **File Upload Errors** (Multer)
   - File size limits → 413 Payload Too Large
   - File type restrictions → 400 Bad Request
   - Upload failures → 400 Bad Request

5. **AWS Service Errors**
   - S3 failures → 500 Internal Server Error
   - Bedrock API failures → 500 Internal Server Error
   - Service timeouts → 503 Service Unavailable

6. **Rate Limiting**
   - Too many requests → 429 Too Many Requests

#### Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "User-friendly error message",
    "code": "ERROR_CODE",
    "errorId": "err_1234567890_abc123",
    "timestamp": "2024-01-15T10:30:00Z",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "invalid_string"
      }
    ]
  }
}
```

### Custom Error Classes

```typescript
// Create custom errors with specific codes
import { AppError, createError } from '@/middleware/errorHandler';

// Usage examples
throw createError('User not found', 404, 'USER_NOT_FOUND');
throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
```

### Validation Schemas

All API endpoints use Zod schemas for input validation:

```typescript
import { validateSchema, schemas } from '@/schemas/validation';

// Apply validation to routes
router.post('/guides', 
  validateSchema(schemas.guides.create),
  createGuide
);
```

### Async Error Handling

All async route handlers use the `asyncHandler` wrapper:

```typescript
import { asyncHandler } from '@/middleware/errorHandler';

router.get('/guides', asyncHandler(async (req, res) => {
  // Any thrown errors are automatically caught and handled
  const guides = await guideService.getGuides(req.user.id);
  res.json({ success: true, data: guides });
}));
```

## Frontend Error Handling

### Error Boundaries

React error boundaries catch JavaScript errors in components:

```tsx
import { ErrorBoundary, FeatureErrorBoundary } from '@/components/ErrorBoundary';

// Wrap entire app
<ErrorBoundary>
  <App />
</ErrorBoundary>

// Wrap specific features
<FeatureErrorBoundary featureName="Guide Editor">
  <GuideEditor />
</FeatureErrorBoundary>
```

### Error Hooks

Use the error handling hooks for functional components:

```tsx
import { useErrorHandler } from '@/components/ErrorBoundary';

function MyComponent() {
  const { captureError } = useErrorHandler();
  
  const handleAsyncOperation = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      captureError(error);
    }
  };
}
```

### Form Validation

Comprehensive form validation with real-time feedback:

```tsx
import { useFormValidation, validationSchemas } from '@/hooks/useValidation';

function LoginForm() {
  const {
    data,
    setValue,
    handleSubmit,
    getFieldError,
    hasErrors
  } = useFormValidation(validationSchemas.auth.login);
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        value={data.email || ''}
        onChange={(e) => setValue('email', e.target.value)}
      />
      {getFieldError('email') && (
        <span className="error">{getFieldError('email')}</span>
      )}
    </form>
  );
}
```

### Network Error Handling

Automatic network request logging and error handling:

```typescript
import { logger } from '@/lib/logger';

// Automatic request/response logging
logger.logRequest('POST', '/api/guides', 201, 150);

// Error logging with context
logger.error('API request failed', {
  url: '/api/guides',
  method: 'POST',
  status: 500,
  error: errorObject
});
```

## Error Logging and Monitoring

### Development Logging

In development, errors include:
- Full stack traces
- Request context
- User information
- Component stack (for React errors)

### Production Logging

In production, errors include:
- Sanitized error messages
- Error IDs for tracking
- Performance metrics
- User-friendly fallbacks

### Log Levels

- **DEBUG**: Detailed development information
- **INFO**: General application flow
- **WARN**: Potential issues that don't break functionality
- **ERROR**: Actual errors that need attention

### External Service Integration

Ready for integration with external monitoring services:

```typescript
// Example Sentry integration
if (process.env.NODE_ENV === 'production') {
  Sentry.captureException(error, {
    contexts: { 
      react: errorInfo,
      user: { id: userId },
      request: { url, method }
    }
  });
}
```

## Error Recovery Strategies

### Automatic Retry

For transient failures:

```typescript
// Automatic retry with exponential backoff
const retryOperation = async (operation, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};
```

### Graceful Degradation

Components fall back to simplified functionality:

```tsx
// Feature detection and fallback
function AdvancedEditor() {
  const [hasAdvancedFeatures, setHasAdvancedFeatures] = useState(true);
  
  if (!hasAdvancedFeatures) {
    return <SimpleTextEditor />;
  }
  
  return (
    <ErrorBoundary
      fallback={<SimpleTextEditor />}
      onError={() => setHasAdvancedFeatures(false)}
    >
      <RichTextEditor />
    </ErrorBoundary>
  );
}
```

### User-Initiated Recovery

Users can trigger recovery actions:

```tsx
// Retry button in error UI
<button onClick={() => window.location.reload()}>
  Reload Page
</button>

<button onClick={handleRetry}>
  Try Again
</button>
```

## Common Error Scenarios

### Database Connection Issues

**Symptoms**: Connection timeouts, "database is starting up"

**Handling**:
- Automatic connection retry with exponential backoff
- Health check endpoints return service status
- Graceful degradation to cached data when possible

### AWS Service Outages

**Symptoms**: S3 upload failures, Bedrock API errors

**Handling**:
- Retry mechanism for transient failures
- Fallback to local processing when possible
- Clear user messaging about service availability

### Network Connectivity

**Symptoms**: Request timeouts, connection refused

**Handling**:
- Offline detection and user notification
- Queue operations for retry when online
- Local storage fallbacks where appropriate

### Browser Compatibility

**Symptoms**: JavaScript errors, missing features

**Handling**:
- Feature detection and polyfills
- Progressive enhancement approach
- Clear browser requirement messaging

## Testing Error Handling

### Unit Tests

Test error scenarios in isolation:

```typescript
describe('Error Handling', () => {
  it('should handle validation errors', async () => {
    const response = await request(app)
      .post('/api/guides')
      .send({ title: '' })
      .expect(400);
      
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toBeDefined();
  });
});
```

### Integration Tests

Test error handling across system boundaries:

```typescript
it('should handle database connection failures', async () => {
  // Simulate database failure
  await database.close();
  
  const response = await request(app)
    .get('/api/guides')
    .expect(503);
    
  expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
});
```

### Error Simulation

Tools for simulating errors in development:

```typescript
// Environment variable to enable error simulation
if (process.env.SIMULATE_ERRORS === 'true') {
  // Randomly fail 10% of requests
  if (Math.random() < 0.1) {
    throw new Error('Simulated error for testing');
  }
}
```

## Best Practices

### For Developers

1. **Always use asyncHandler** for async route handlers
2. **Validate all inputs** using Zod schemas
3. **Log errors with context** for debugging
4. **Provide user-friendly messages** in production
5. **Test error scenarios** thoroughly

### For Error Messages

1. **Be specific** about what went wrong
2. **Suggest solutions** when possible
3. **Use consistent language** across the application
4. **Avoid technical jargon** in user-facing messages
5. **Include help links** for complex issues

### For Recovery

1. **Provide retry mechanisms** for transient failures
2. **Save user work** before showing errors
3. **Offer alternative paths** when features fail
4. **Clear instructions** for manual recovery
5. **Contact information** for unresolvable issues

## Configuration

### Environment Variables

```env
# Error handling configuration
LOG_LEVEL=error
ENABLE_ERROR_REPORTING=true
SENTRY_DSN=your_sentry_dsn_here
ERROR_REPORTING_SAMPLE_RATE=0.1

# Development settings
DEBUG=processmaster:*
SIMULATE_ERRORS=false
DETAILED_ERRORS=true
```

### Feature Flags

Control error handling behavior:

```typescript
// Feature flags for error handling
const errorHandlingConfig = {
  enableRetry: process.env.ENABLE_RETRY !== 'false',
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  showDetailedErrors: process.env.NODE_ENV === 'development',
  enableErrorReporting: process.env.ENABLE_ERROR_REPORTING === 'true',
};
```

## Monitoring and Alerting

### Key Metrics to Monitor

- Error rate by endpoint
- Response time distribution
- Database connection failures
- AWS service failures
- User error recovery success rate

### Alert Conditions

- Error rate > 5% for any endpoint
- Response time > 2 seconds for 95th percentile
- Database connection failures
- AWS service quota limits reached
- Critical errors in production

### Dashboard Widgets

- Real-time error rate graphs
- Error distribution by type
- User impact assessment
- Recovery success rates
- Performance correlations

This comprehensive error handling system ensures that ProcessMaster Pro provides a robust, user-friendly experience even when things go wrong, while giving developers the tools they need to quickly identify and resolve issues.