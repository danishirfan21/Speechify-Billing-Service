import Redis from 'redis';
import { logger } from '../utils/logger';

class CacheService {
  private client: any;
  private connected = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      this.client = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD,
      });

      this.client.on('error', (err: Error) => {
        logger.error('Redis client error:', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.connected = true;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) return null;

    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.connected) return;

    try {
      const serialized = JSON.stringify(value);

      if (ttl) {
        await this.client.setEx(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async clearPattern(pattern: string): Promise<void> {
    if (!this.connected) return;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error(`Cache clear pattern error for ${pattern}:`, error);
    }
  }

  async increment(key: string, amount = 1): Promise<number> {
    if (!this.connected) return 0;

    try {
      return await this.client.incrBy(key, amount);
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  async setWithExpiry(key: string, value: any, seconds: number): Promise<void> {
    await this.set(key, value, seconds);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  // Cache dashboard metrics
  async cacheMetrics(metrics: any): Promise<void> {
    await this.set('dashboard:metrics', metrics, 3600); // 1 hour
  }

  async getMetrics(): Promise<any> {
    return await this.get('dashboard:metrics');
  }

  // Cache customer data
  async cacheCustomer(customerId: string, data: any): Promise<void> {
    await this.set(`customer:${customerId}`, data, 1800); // 30 minutes
  }

  async getCachedCustomer(customerId: string): Promise<any> {
    return await this.get(`customer:${customerId}`);
  }

  async invalidateCustomer(customerId: string): Promise<void> {
    await this.delete(`customer:${customerId}`);
  }
}

export const cacheService = new CacheService();
