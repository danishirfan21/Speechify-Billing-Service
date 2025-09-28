import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom body parser for Stripe webhooks that preserves the raw body
 * This is required for webhook signature verification
 */
export const webhookBodyParser = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method !== 'POST') {
    next();
    return;
  }

  const contentType = req.headers['content-type'];

  // Only process JSON content for webhooks
  if (!contentType || !contentType.includes('application/json')) {
    next();
    return;
  }

  let data = '';

  // Set encoding to preserve raw bytes
  req.setEncoding('utf8');

  req.on('data', (chunk: string) => {
    data += chunk;
  });

  req.on('end', () => {
    try {
      // Store raw body for signature verification
      (req as any).rawBody = Buffer.from(data, 'utf8');

      // Parse JSON and attach to req.body
      if (data) {
        req.body = JSON.parse(data);
      } else {
        req.body = {};
      }

      logger.debug('Webhook body parsed', {
        contentLength: data.length,
        hasSignature: !!req.headers['stripe-signature'],
        path: req.path,
      });

      next();
    } catch (error) {
      logger.error('Failed to parse webhook body', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentType,
        bodyLength: data.length,
        path: req.path,
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body',
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  req.on('error', (error: Error) => {
    logger.error('Error reading webhook body', {
      error: error.message,
      path: req.path,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'BODY_READ_ERROR',
        message: 'Error reading request body',
      },
      timestamp: new Date().toISOString(),
    });
  });
};
