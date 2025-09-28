import { RedisOptions } from 'redis';

export const redisConfig: RedisOptions = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  connectTimeout: 10000,
  commandTimeout: 5000,
};

export const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  blockDuration: 60, // seconds
};

export const sessionConfig = {
  prefix: 'speechify:session:',
  ttl: 24 * 60 * 60, // 24 hours in seconds
};
