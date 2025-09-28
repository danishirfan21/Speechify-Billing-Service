import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { BillingError } from '../types';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
  timestamp: string;
  requestId?: string;
}

export const errorHandler = (
  error: Error | BillingError,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Generate request ID for tracking
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();

  // Log the error
  logger.error('Request error', {
    requestId,
    method: req.method,
    path: req.path,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Prepare error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
    timestamp: new Date().toISOString(),
    requestId,
  };

  // Handle different error types
  if (isBillingError(error)) {
    errorResponse.error.code = error.code;
    errorResponse.error.message = error.message;
    errorResponse.error.details = error.details;

    res.status(error.statusCode || 500).json(errorResponse);
    return;
  }

  // Handle Stripe errors
  if (error.name === 'StripeError') {
    errorResponse.error.code = 'PAYMENT_ERROR';
    errorResponse.error.message = error.message;

    res.status(402).json(errorResponse);
    return;
  }

  // Handle validation errors (Joi)
  if (error.name === 'ValidationError') {
    errorResponse.error.code = 'VALIDATION_ERROR';
    errorResponse.error.message = 'Request validation failed';
    errorResponse.error.details = (error as any).details;

    res.status(400).json(errorResponse);
    return;
  }

  // Handle database errors
  if (
    error.message.includes('duplicate key value') ||
    error.message.includes('violates unique constraint')
  ) {
    errorResponse.error.code = 'DUPLICATE_RESOURCE';
    errorResponse.error.message = 'Resource already exists';

    res.status(409).json(errorResponse);
    return;
  }

  if (error.message.includes('violates foreign key constraint')) {
    errorResponse.error.code = 'INVALID_REFERENCE';
    errorResponse.error.message = 'Referenced resource not found';

    res.status(400).json(errorResponse);
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    errorResponse.error.code = 'INVALID_TOKEN';
    errorResponse.error.message = 'Invalid authentication token';

    res.status(401).json(errorResponse);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    errorResponse.error.code = 'TOKEN_EXPIRED';
    errorResponse.error.message = 'Authentication token has expired';

    res.status(401).json(errorResponse);
    return;
  }

  // Handle network/connection errors
  if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
    errorResponse.error.code = 'SERVICE_UNAVAILABLE';
    errorResponse.error.message = 'External service unavailable';

    res.status(503).json(errorResponse);
    return;
  }

  // Handle timeout errors
  if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
    errorResponse.error.code = 'REQUEST_TIMEOUT';
    errorResponse.error.message = 'Request timeout';

    res.status(408).json(errorResponse);
    return;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = error.stack;
    errorResponse.error.message = error.message;
  }

  // Default error response
  res.status(500).json(errorResponse);
};

// Type guard for BillingError
function isBillingError(error: any): error is BillingError {
  return error && typeof error.code === 'string' && typeof error.statusCode === 'number';
}

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled promise rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise,
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  });

  // Gracefully shutdown
  process.exit(1);
});
