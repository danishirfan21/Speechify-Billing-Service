import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RequestLogData {
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userAgent?: string;
  apiKey?: string;
  duration?: number;
  statusCode?: number;
  contentLength?: number;
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();

  // Add request ID to request for use in other middleware
  (req as any).requestId = requestId;

  // Add request ID to response headers
  res.setHeader('x-request-id', requestId);

  // Prepare base log data
  const logData: RequestLogData = {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'],
  };

  // Extract API key if present (for logging, not the actual key)
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    logData.apiKey = `${apiKey.substring(0, 8)}...`;
  }

  // Log request start
  logger.info('Request started', {
    ...logData,
    query: req.query,
    // Don't log sensitive data in body
    bodySize: req.headers['content-length'] || 0,
  });

  // Override res.end to capture response data
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - startTime;

    // Complete log data
    logData.duration = duration;
    logData.statusCode = res.statusCode;
    logData.contentLength = res.getHeader('content-length') as number;

    // Log request completion
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    logger[logLevel]('Request completed', logData);

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        ...logData,
        threshold: 1000,
      });
    }

    // Call original end method
    originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Middleware to log specific events
export const logEvent = (eventType: string, data?: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = (req as any).requestId || 'unknown';

    logger.info(`Event: ${eventType}`, {
      requestId,
      eventType,
      path: req.path,
      method: req.method,
      data,
    });

    next();
  };
};

// Middleware to exclude certain paths from logging
export const skipLogging = (paths: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (paths.includes(req.path)) {
      next();
      return;
    }

    requestLogger(req, res, next);
  };
};
