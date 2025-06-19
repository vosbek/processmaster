import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { z } from 'zod';

export interface CustomError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
  code?: string;
  details?: any;
}

export class AppError extends Error implements CustomError {
  statusCode: number;
  status: string;
  isOperational: boolean;
  code?: string;
  details?: any;

  constructor(message: string, statusCode: number, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (message: string, statusCode: number, code?: string, details?: any) => {
  return new AppError(message, statusCode, code, details);
};

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Create a unique error ID for tracking
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Enhanced logging with request context
  logger.error({
    errorId,
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
    statusCode: error.statusCode,
    code: error.code,
    details: error.details,
  });

  // PostgreSQL errors
  if (err.name === 'PostgresError' || (err as any).code?.startsWith('23')) {
    switch ((err as any).code) {
      case '23505': // Unique violation
        error = { 
          ...error, 
          message: 'Duplicate entry. This resource already exists.', 
          statusCode: 409,
          code: 'DUPLICATE_ENTRY'
        };
        break;
      case '23503': // Foreign key violation
        error = { 
          ...error, 
          message: 'Referenced resource does not exist.', 
          statusCode: 400,
          code: 'INVALID_REFERENCE'
        };
        break;
      case '23502': // Not null violation
        error = { 
          ...error, 
          message: 'Required field is missing.', 
          statusCode: 400,
          code: 'MISSING_FIELD'
        };
        break;
      default:
        error = { 
          ...error, 
          message: 'Database operation failed.', 
          statusCode: 500,
          code: 'DATABASE_ERROR'
        };
    }
  }

  // Zod validation errors
  if (err instanceof z.ZodError) {
    const validationErrors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));
    
    error = {
      ...error,
      message: 'Validation failed',
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details: validationErrors,
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = { 
      ...error, 
      message: 'Invalid authentication token', 
      statusCode: 401,
      code: 'INVALID_TOKEN'
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = { 
      ...error, 
      message: 'Authentication token has expired', 
      statusCode: 401,
      code: 'TOKEN_EXPIRED'
    };
  }

  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    switch ((err as any).code) {
      case 'LIMIT_FILE_SIZE':
        error = { 
          ...error, 
          message: 'File too large', 
          statusCode: 413,
          code: 'FILE_TOO_LARGE'
        };
        break;
      case 'LIMIT_FILE_COUNT':
        error = { 
          ...error, 
          message: 'Too many files', 
          statusCode: 413,
          code: 'TOO_MANY_FILES'
        };
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        error = { 
          ...error, 
          message: 'Unexpected file field', 
          statusCode: 400,
          code: 'UNEXPECTED_FILE'
        };
        break;
      default:
        error = { 
          ...error, 
          message: 'File upload failed', 
          statusCode: 400,
          code: 'UPLOAD_ERROR'
        };
    }
  }

  // AWS S3 errors
  if ((err as any).code?.startsWith('S3') || err.name === 'S3ServiceException') {
    error = { 
      ...error, 
      message: 'File storage operation failed', 
      statusCode: 500,
      code: 'STORAGE_ERROR'
    };
  }

  // Rate limiting errors
  if (err.name === 'TooManyRequestsError') {
    error = { 
      ...error, 
      message: 'Too many requests. Please try again later.', 
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED'
    };
  }

  // LDAP/OAuth errors
  if (err.name === 'LDAPError' || err.name === 'OAuthError') {
    error = { 
      ...error, 
      message: 'Authentication service unavailable', 
      statusCode: 503,
      code: 'AUTH_SERVICE_ERROR'
    };
  }

  // Network/timeout errors
  if (err.name === 'TimeoutError' || (err as any).code === 'ECONNRESET') {
    error = { 
      ...error, 
      message: 'Service temporarily unavailable', 
      statusCode: 503,
      code: 'SERVICE_TIMEOUT'
    };
  }

  // Default to 500 server error if statusCode is not set
  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Prepare response
  const response: any = {
    success: false,
    error: {
      message: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
      errorId,
      timestamp: new Date().toISOString(),
    },
  };

  // Add details for validation errors
  if (error.details) {
    response.error.details = error.details;
  }

  // Include stack trace in development
  if (!isProduction) {
    response.error.stack = err.stack;
    response.error.originalError = {
      name: err.name,
      message: err.message,
    };
  }

  // Send appropriate status messages for different error types
  if (statusCode >= 500) {
    response.error.message = isProduction 
      ? 'Internal server error. Please try again later.' 
      : error.message;
  }

  res.status(statusCode).json(response);
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = createError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Validation middleware generator
export const validateSchema = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Rate limiting error
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'TooManyRequestsError';
  }
}