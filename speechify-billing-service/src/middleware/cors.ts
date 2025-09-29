import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface CorsOptions {
  origin?:
    | string
    | string[]
    | ((
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => void);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

// Default CORS configuration
const defaultOptions: CorsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8080',
    'https://dashboard.speechify.com',
    'https://admin.speechify.com',
  ],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-api-key',
    'stripe-signature',
    'x-request-id',
    'x-client-version',
    'accept',
    'accept-language',
    'content-language',
  ],
  exposedHeaders: [
    'x-request-id',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 204,
};

// Dynamic origin validation function
const dynamicOrigin = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => {
  // Allow requests with no origin (mobile apps, curl, etc.)
  if (!origin) {
    return callback(null, true);
  }

  // Get allowed origins from environment or use defaults
  const allowedOrigins =
    process.env.ALLOWED_ORIGINS?.split(',') || (defaultOptions.origin as string[]);

  // Check for exact match
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  // In development, allow localhost with any port
  if (process.env.NODE_ENV === 'development') {
    const localhostPattern = /^https?:\/\/localhost(:\d+)?$/;
    const localIPPattern = /^https?:\/\/127\.0\.0\.1(:\d+)?$/;
    const localNetworkPattern = /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/;

    if (
      localhostPattern.test(origin) ||
      localIPPattern.test(origin) ||
      localNetworkPattern.test(origin)
    ) {
      logger.debug('Development: Allowing localhost origin', { origin });
      return callback(null, true);
    }
  }

  // Check for subdomain patterns (e.g., *.speechify.com)
  const allowedDomains = process.env.ALLOWED_DOMAINS?.split(',') || [];
  for (const domain of allowedDomains) {
    if (domain.startsWith('*.')) {
      const baseDomain = domain.slice(2);
      const originURL = new URL(origin);
      if (originURL.hostname.endsWith(baseDomain)) {
        logger.debug('Allowing subdomain origin', { origin, pattern: domain });
        return callback(null, true);
      }
    }
  }

  // Log rejected origins for debugging
  logger.warn('CORS: Origin not allowed', {
    origin,
    allowedOrigins,
    userAgent: 'Not available in preflight',
  });

  return callback(new Error(`CORS: Origin ${origin} not allowed`), false);
};

export const corsMiddleware = (options: CorsOptions = {}) => {
  const corsOptions = { ...defaultOptions, ...options };

  // Use dynamic origin if not explicitly set
  if (!corsOptions.origin) {
    corsOptions.origin = dynamicOrigin;
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const method = req.method;

    // Handle origin
    const handleOrigin = (err: Error | null, allow?: boolean) => {
      if (err) {
        logger.warn('CORS origin check failed', {
          origin,
          error: err.message,
          method,
          path: req.path,
        });
        return res.status(403).json({
          success: false,
          error: {
            code: 'CORS_NOT_ALLOWED',
            message: 'Origin not allowed by CORS policy',
          },
        });
      }

      if (allow && origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else if (allow && !origin) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      // Set other CORS headers
      if (corsOptions.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      if (corsOptions.exposedHeaders) {
        res.setHeader(
          'Access-Control-Expose-Headers',
          Array.isArray(corsOptions.exposedHeaders)
            ? corsOptions.exposedHeaders.join(', ')
            : corsOptions.exposedHeaders,
        );
      }

      // Handle preflight requests
      if (method === 'OPTIONS') {
        if (corsOptions.methods) {
          res.setHeader(
            'Access-Control-Allow-Methods',
            Array.isArray(corsOptions.methods)
              ? corsOptions.methods.join(', ')
              : corsOptions.methods,
          );
        }

        if (corsOptions.allowedHeaders) {
          res.setHeader(
            'Access-Control-Allow-Headers',
            Array.isArray(corsOptions.allowedHeaders)
              ? corsOptions.allowedHeaders.join(', ')
              : corsOptions.allowedHeaders,
          );
        }

        if (corsOptions.maxAge) {
          res.setHeader('Access-Control-Max-Age', corsOptions.maxAge.toString());
        }

        // End preflight request
        res.status(corsOptions.optionsSuccessStatus || 204).end();
        return;
      }

      next();
    };

    // Check origin
    if (typeof corsOptions.origin === 'function') {
      corsOptions.origin(origin, handleOrigin);
    } else if (Array.isArray(corsOptions.origin)) {
      const allowed = !origin || corsOptions.origin.includes(origin);
      handleOrigin(null, allowed);
    } else if (typeof corsOptions.origin === 'string') {
      const allowed = !origin || corsOptions.origin === origin || corsOptions.origin === '*';
      handleOrigin(null, allowed);
    } else {
      handleOrigin(null, true);
    }
  };
};

// Specific CORS configurations for different routes
export const adminCorsMiddleware = corsMiddleware({
  origin: ['https://admin.speechify.com', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

export const webhookCorsMiddleware = corsMiddleware({
  origin: ['https://api.stripe.com'],
  credentials: false,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'stripe-signature'],
});

export const publicApiCorsMiddleware = corsMiddleware({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Security headers middleware
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Set CSP for non-API routes
  if (!req.path.startsWith('/api/')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';",
    );
  }

  // HSTS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

// Rate limiting headers
export const rateLimitHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // These would typically be set by the rate limiter middleware
  // This is just a placeholder for consistent header structure
  const limit = process.env.RATE_LIMIT_MAX_REQUESTS || '100';
  const window = process.env.RATE_LIMIT_WINDOW_MS || '900000';

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Window', window);

  next();
};

export default corsMiddleware;
