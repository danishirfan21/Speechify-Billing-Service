import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { logger } from '../utils/logger';

// API Security Middleware
export const apiSecurityMiddleware = [
  // Helmet for security headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),

  // Request sanitization
  (req: Request, res: Response, next: NextFunction) => {
    // Remove potentially dangerous characters from query params
    if (req.query) {
      Object.keys(req.query).forEach((key) => {
        if (typeof req.query[key] === 'string') {
          req.query[key] = (req.query[key] as string).replace(/[<>]/g, '').trim();
        }
      });
    }

    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    next();
  },

  // Request size limiting
  (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload too large',
        },
      });
    }

    next();
  },

  // IP whitelisting (optional)
  (req: Request, res: Response, next: NextFunction) => {
    const whitelist = process.env.IP_WHITELIST?.split(',') || [];

    if (whitelist.length > 0) {
      const clientIp = req.ip || req.connection.remoteAddress;

      if (!whitelist.includes(clientIp || '')) {
        logger.warn('Unauthorized IP access attempt', { ip: clientIp });
        return res.status(403).json({
          success: false,
          error: {
            code: 'IP_NOT_ALLOWED',
            message: 'Access denied',
          },
        });
      }
    }

    next();
  },
];

// SQL Injection prevention
export const sanitizeInput = (input: string): string => {
  return input.replace(/[^\w\s@.-]/gi, '').trim();
};

// XSS prevention
export const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
};

// Validate webhook signature
export const validateWebhookSignature = (
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean => {
  try {
    const crypto = require('crypto');
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (error) {
    logger.error('Webhook signature validation failed:', error);
    return false;
  }
};

// API key rotation detection
export const detectApiKeyRotation = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;

  // Check if API key is expired or rotated
  // This would typically check against a database
  if (apiKey && apiKey.includes('_expired_')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'API_KEY_EXPIRED',
        message: 'API key has been rotated. Please use the new key.',
      },
    });
  }

  next();
};

// Prevent timing attacks
export const constantTimeCompare = (a: string, b: string): boolean => {
  try {
    const crypto = require('crypto');
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    if (bufferA.length !== bufferB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufferA, bufferB);
  } catch {
    return false;
  }
};

export default apiSecurityMiddleware;
