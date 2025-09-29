import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { initializeDatabase, closeDatabase } from './database/connection';
import { billingRoutes } from './routes/billing.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { adminRoutes } from './routes/admin.routes';
import { healthRoutes } from './routes/health.routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { webhookBodyParser } from './middleware/webhookBodyParser';
import { corsMiddleware, securityHeadersMiddleware } from './middleware/cors';
import { apiSecurityMiddleware } from './middleware/security';
import { logger } from './utils/logger';
import { setupCronJobs } from './utils/cronJobs';
import { swaggerOptions } from './config/swagger';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware - Apply early
app.use(securityHeadersMiddleware);

// CORS middleware
app.use(corsMiddleware());

// Compression middleware
app.use(compression());

// Request logging
app.use(requestLogger);

// Body parsing middleware - Order matters!
// Webhook routes need raw body for signature verification
app.use('/api/billing/webhooks', webhookBodyParser);

// JSON parsing for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Documentation
const specs = swaggerJsdoc(swaggerOptions);
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #4F46E5; }
    `,
    customSiteTitle: 'Speechify Billing API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: 2,
    },
  }),
);

// Health check endpoints (no auth required)
app.use('/health', healthRoutes);
app.use('/', healthRoutes); // Mount health routes at root for /ready, /live, /metrics

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Speechify Billing Service API',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    documentation: '/api/docs',
    health: '/health',
    endpoints: {
      billing: '/api/billing',
      admin: '/api/admin',
      webhooks: '/api/billing/webhooks',
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
      dunning_management: true,
      proration: true,
    },
    timestamp: new Date().toISOString(),
  });
});

// API Routes with security middleware
app.use('/api/billing/webhooks', webhookRoutes);
app.use('/api/billing', apiSecurityMiddleware, billingRoutes);
app.use('/api/admin', adminRoutes);

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'operational',
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'healthy', // Would check actual status
      stripe: 'healthy',
      email: 'healthy',
      redis: 'healthy',
    },
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'API endpoint not found',
    },
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_endpoints: {
      documentation: '/api/docs',
      billing: '/api/billing',
      admin: '/api/admin',
      webhooks: '/api/billing/webhooks',
      health: '/health',
    },
  });
});

// 404 handler for all other routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestion: 'Visit /api/docs for API documentation',
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Global error handlers
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled promise rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
  });
});

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

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      // Close database connections
      await closeDatabase();
      logger.info('Database connections closed');

      // Close other connections (Redis, etc.)
      // await closeRedisConnection();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    });

    // Force close after timeout
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Initialize server
const startServer = async () => {
  try {
    logger.info('Starting Speechify Billing Service...');

    // Initialize database
    await initializeDatabase();
    logger.info('✅ Database initialized successfully');

    // Setup cron jobs
    if (process.env.NODE_ENV !== 'test') {
      setupCronJobs();
      logger.info('✅ Cron jobs initialized');
    }

    // Start server
    const server = app.listen(PORT, () => {
      logger.info('🚀 Speechify Billing Service started successfully');
      logger.info(`📋 Server running on port ${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
      logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
      logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📊 Metrics: http://localhost:${PORT}/metrics`);
      logger.info(`🎯 Admin Dashboard: http://localhost:${PORT}/api/admin/dashboard`);

      // Log important configuration
      const config = {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        database: process.env.DB_NAME || 'speechify_billing',
        stripe_mode: process.env.STRIPE_SECRET_KEY?.includes('test') ? 'test' : 'live',
        log_level: process.env.LOG_LEVEL || 'info',
        rate_limit: process.env.RATE_LIMIT_MAX_REQUESTS || '100',
      };
      logger.info('📋 Configuration loaded:', config);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle PM2 graceful shutdown
    process.on('message', (msg) => {
      if (msg === 'shutdown') {
        gracefulShutdown('PM2 shutdown');
      }
    });

    return server;
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server only if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { app, startServer };
