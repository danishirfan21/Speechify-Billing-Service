import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'redis';
import { logger } from '../utils/logger';

// Create Redis client
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

redisClient.connect().catch((err) => {
  logger.error('Failed to connect to Redis:', err);
});

// Rate limiter configuration
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyName: 'api_rate_limit',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // Number of requests
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900'), // Per 15 minutes (900 seconds)
  blockDuration: 60, // Block for 60 seconds if limit exceeded
});

// Webhook rate limiter (more permissive)
const webhookRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyName: 'webhook_rate_limit',
  points: 1000, // Higher limit for webhooks
  duration: 900, // Per 15 minutes
  blockDuration: 60,
});

// Admin rate limiter (more restrictive)
const adminRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyName: 'admin_rate_limit',
  points: 50, // Lower limit for admin operations
  duration: 900,
  blockDuration: 300, // Block for 5 minutes
});

export const createRateLimiter = (limiter: RateLimiterRedis) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Use IP address as key, but could also use user ID or API key
      const key = req.ip || req.connection.remoteAddress || 'unknown';

      await limiter.consume(key);
      next();
    } catch (rejRes: any) {
      const totalHits = rejRes.totalHits || 0;
      const remainingPoints = rejRes.remainingPoints || 0;
      const msBeforeNext = rejRes.msBeforeNext || 0;

      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        totalHits,
        remainingPoints,
        msBeforeNext,
      });

      res.set({
        'Retry-After': Math.round(msBeforeNext / 1000) || 1,
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': remainingPoints < 0 ? 0 : remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.round(msBeforeNext / 1000),
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
};

// Export specific rate limiters
export const rateLimiterMiddleware = createRateLimiter(rateLimiter);
export const webhookRateLimiterMiddleware = createRateLimiter(webhookRateLimiter);
export const adminRateLimiterMiddleware = createRateLimiter(adminRateLimiter);

// Default export
export default rateLimiterMiddleware;
