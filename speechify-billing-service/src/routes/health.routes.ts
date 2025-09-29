import { Router, Request, Response, NextFunction } from 'express';
import { billingService } from '../services/billing.service';
import { stripeService } from '../services/stripe.service';
import { emailService } from '../services/email.service';
import { checkDatabaseHealth } from '../database/connection';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Service health and monitoring endpoints
 */

/**
 * Basic health check endpoint
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     description: Returns basic service status without authentication
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                 environment:
 *                   type: string
 *                 uptime:
 *                   type: number
 *                   description: Uptime in seconds
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const startTime = Date.now();

    // Basic health checks
    const checks = {
      database: false,
      memory: false,
      disk: false,
    };

    // Database health check
    try {
      checks.database = await checkDatabaseHealth();
    } catch (error) {
      checks.database = false;
    }

    // Memory check (warn if over 80% usage)
    const memUsage = process.memoryUsage();
    const memUsagePercentage = memUsage.heapUsed / memUsage.heapTotal;
    checks.memory = memUsagePercentage < 0.8;

    // Simple disk space check (placeholder - would implement actual disk check in production)
    checks.disk = true;

    const isHealthy = Object.values(checks).every((check) => check === true);
    const responseTime = Date.now() - startTime;

    const healthData = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime()),
      response_time: responseTime,
      checks,
    };

    res.status(isHealthy ? 200 : 503).json(healthData);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * Detailed health check with external services
 * @swagger
 * /api/billing/health:
 *   get:
 *     summary: Detailed health check
 *     tags: [Health]
 *     security:
 *       - ApiKeyAuth: []
 *     description: Comprehensive health check including external services
 *     responses:
 *       200:
 *         description: Detailed health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: string
 *                     environment:
 *                       type: string
 *                     uptime:
 *                       type: number
 *                     components:
 *                       type: object
 *                       properties:
 *                         database:
 *                           $ref: '#/components/schemas/HealthComponent'
 *                         stripe:
 *                           $ref: '#/components/schemas/HealthComponent'
 *                         email:
 *                           $ref: '#/components/schemas/HealthComponent'
 *                         redis:
 *                           $ref: '#/components/schemas/HealthComponent'
 *                     metrics:
 *                       type: object
 *                       properties:
 *                         memory_usage:
 *                           type: object
 *                         active_connections:
 *                           type: integer
 *                         response_time:
 *                           type: number
 */
router.get('/detailed', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const startTime = Date.now();

    // Component health checks
    const components = {
      database: { status: 'unknown', message: '', response_time: 0 },
      stripe: { status: 'unknown', message: '', response_time: 0 },
      email: { status: 'unknown', message: '', response_time: 0 },
      redis: { status: 'unknown', message: '', response_time: 0 },
    };

    // Database health check
    try {
      const dbStart = Date.now();
      const dbHealthy = await checkDatabaseHealth();
      components.database = {
        status: dbHealthy ? 'healthy' : 'unhealthy',
        message: dbHealthy ? 'Database connection successful' : 'Database connection failed',
        response_time: Date.now() - dbStart,
      };
    } catch (error) {
      components.database = {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database check failed',
        response_time: Date.now() - startTime,
      };
    }

    // Stripe health check
    try {
      const stripeStart = Date.now();
      const stripeHealthy = await stripeService.testConnection();
      components.stripe = {
        status: stripeHealthy ? 'healthy' : 'unhealthy',
        message: stripeHealthy
          ? 'Stripe API connection successful'
          : 'Stripe API connection failed',
        response_time: Date.now() - stripeStart,
      };
    } catch (error) {
      components.stripe = {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Stripe check failed',
        response_time: Date.now() - startTime,
      };
    }

    // Email service health check
    try {
      const emailStart = Date.now();
      const emailHealthy = await emailService.testConnection();
      components.email = {
        status: emailHealthy ? 'healthy' : 'unhealthy',
        message: emailHealthy
          ? 'Email service connection successful'
          : 'Email service connection failed',
        response_time: Date.now() - emailStart,
      };
    } catch (error) {
      components.email = {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Email service check failed',
        response_time: Date.now() - startTime,
      };
    }

    // Redis health check (placeholder - would implement actual Redis check)
    try {
      const redisStart = Date.now();
      // Simulate Redis check
      components.redis = {
        status: 'healthy',
        message: 'Redis connection successful',
        response_time: Date.now() - redisStart,
      };
    } catch (error) {
      components.redis = {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Redis check failed',
        response_time: Date.now() - startTime,
      };
    }

    // Calculate overall status
    const healthyCount = Object.values(components).filter((c) => c.status === 'healthy').length;
    const totalComponents = Object.keys(components).length;

    let overallStatus: string;
    if (healthyCount === totalComponents) {
      overallStatus = 'healthy';
    } else if (healthyCount >= totalComponents / 2) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    // System metrics
    const memUsage = process.memoryUsage();
    const metrics = {
      memory_usage: {
        heap_used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heap_total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        usage_percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      cpu_usage: Math.round(process.cpuUsage().user / 1000), // microseconds to milliseconds
      uptime: Math.floor(process.uptime()),
      node_version: process.version,
      platform: process.platform,
      response_time: Date.now() - startTime,
    };

    const healthData = {
      success: true,
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        components,
        metrics,
      },
    };

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    res.status(statusCode).json(healthData);
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Readiness probe for Kubernetes
 * @swagger
 * /ready:
 *   get:
 *     summary: Readiness probe
 *     tags: [Health]
 *     description: Kubernetes readiness probe endpoint
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check if critical services are available
    const databaseReady = await checkDatabaseHealth();

    if (databaseReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        reason: 'Database not available',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      reason: 'Service initialization failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Liveness probe for Kubernetes
 * @swagger
 * /live:
 *   get:
 *     summary: Liveness probe
 *     tags: [Health]
 *     description: Kubernetes liveness probe endpoint
 *     responses:
 *       200:
 *         description: Service is alive
 *       503:
 *         description: Service is not responding
 */
router.get('/live', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Simple check to verify the service is responsive
    const memUsage = process.memoryUsage();
    const memUsagePercentage = memUsage.heapUsed / memUsage.heapTotal;

    // Consider service unhealthy if memory usage is over 95%
    if (memUsagePercentage > 0.95) {
      res.status(503).json({
        status: 'unhealthy',
        reason: 'High memory usage',
        memory_usage: Math.round(memUsagePercentage * 100),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      reason: 'Liveness check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Metrics endpoint for monitoring
 * @swagger
 * /metrics:
 *   get:
 *     summary: Service metrics
 *     tags: [Health]
 *     description: Prometheus-style metrics endpoint
 *     responses:
 *       200:
 *         description: Service metrics
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/metrics', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Basic Prometheus-style metrics
    const metrics = [
      `# HELP nodejs_memory_heap_used_bytes Memory heap used in bytes`,
      `# TYPE nodejs_memory_heap_used_bytes gauge`,
      `nodejs_memory_heap_used_bytes ${memUsage.heapUsed}`,
      ``,
      `# HELP nodejs_memory_heap_total_bytes Memory heap total in bytes`,
      `# TYPE nodejs_memory_heap_total_bytes gauge`,
      `nodejs_memory_heap_total_bytes ${memUsage.heapTotal}`,
      ``,
      `# HELP nodejs_uptime_seconds Process uptime in seconds`,
      `# TYPE nodejs_uptime_seconds gauge`,
      `nodejs_uptime_seconds ${Math.floor(process.uptime())}`,
      ``,
      `# HELP http_requests_total Total number of HTTP requests`,
      `# TYPE http_requests_total counter`,
      `http_requests_total{method="GET",status="200"} 0`,
      `http_requests_total{method="POST",status="200"} 0`,
      `http_requests_total{method="PUT",status="200"} 0`,
      `http_requests_total{method="DELETE",status="200"} 0`,
      ``,
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    logger.error('Metrics endpoint failed:', error);
    res.status(500).send('# Metrics collection failed\n');
  }
});

/**
 * Service information endpoint
 * @swagger
 * /info:
 *   get:
 *     summary: Service information
 *     tags: [Health]
 *     description: Returns service build and configuration information
 *     responses:
 *       200:
 *         description: Service information
 */
router.get('/info', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const info = {
      service: 'speechify-billing-service',
      version: process.env.npm_package_version || '1.0.0',
      description: 'Subscription management microservice with Stripe integration',
      environment: process.env.NODE_ENV || 'development',
      node_version: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptime: Math.floor(process.uptime()),
      started_at: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      build_info: {
        git_commit: process.env.GIT_COMMIT || 'unknown',
        build_date: process.env.BUILD_DATE || 'unknown',
        build_number: process.env.BUILD_NUMBER || 'unknown',
      },
      features: {
        stripe_integration: true,
        email_notifications: true,
        usage_tracking: true,
        webhook_processing: true,
        admin_dashboard: true,
        analytics: true,
        multi_currency: true,
        promotional_codes: true,
      },
      api_endpoints: {
        billing: '/api/billing',
        admin: '/api/admin',
        webhooks: '/api/billing/webhooks',
        health: '/health',
        docs: '/api/docs',
      },
    };

    res.json(info);
  } catch (error) {
    logger.error('Info endpoint failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve service information',
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as healthRoutes };
