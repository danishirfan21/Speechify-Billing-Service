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
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { webhookBodyParser } from './middleware/webhookBodyParser';
import { logger } from './utils/logger';
import { setupCronJobs } from './utils/cronJobs';
import { swaggerOptions } from './config/swagger';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }),
);

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'stripe-signature'],
  }),
);

app.use(compression());

// Request logging
app.use(requestLogger);

// Body parsing middleware - Order matters!
// Webhook routes need raw body
app.use('/api/billing/webhooks', webhookBodyParser);

// JSON parsing for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Documentation
const specs = swaggerJsdoc(swaggerOptions);
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Speechify Billing API Documentation',
  }),
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// API Routes
app.use('/api/billing', billingRoutes);
app.use('/api/billing/webhooks', webhookRoutes);
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Speechify Billing Service API',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close database connections
    await closeDatabase();
    logger.info('Database connections closed');

    // Close server
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Initialize server
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Setup cron jobs
    setupCronJobs();
    logger.info('Cron jobs initialized');

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Speechify Billing Service running on port ${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
      logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server only if this file is run directly
if (require.main === module) {
  startServer();
}

export { app, startServer };
