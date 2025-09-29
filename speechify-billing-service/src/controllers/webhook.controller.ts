import { Request, Response, NextFunction } from 'express';
import { webhookService } from '../services/webhook.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Stripe webhook handling
 */

/**
 * @swagger
 * /api/billing/webhooks/stripe:
 *   post:
 *     summary: Handle Stripe webhook events
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook signature
 */
export const handleStripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'Missing stripe-signature header',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Get raw body for signature verification
    const rawBody = (req as any).rawBody || req.body;

    // Process the webhook
    await webhookService.processWebhook(rawBody, signature);

    logger.info('Webhook processed successfully', {
      signature: signature.substring(0, 20) + '...',
    });

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Webhook processing failed:', error);

    // Return 400 for signature verification failures
    if (error instanceof Error && error.message.includes('signature')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid webhook signature',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Return 500 for other errors but still acknowledge receipt
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_PROCESSING_ERROR',
        message: 'Webhook processing failed',
      },
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * @swagger
 * /api/billing/webhooks/retry:
 *   post:
 *     summary: Retry failed webhook events
 *     tags: [Webhooks]
 *     security:
 *       - BasicAuth: []
 *     responses:
 *       200:
 *         description: Failed webhooks retry initiated
 */
export const retryFailedWebhooks = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await webhookService.retryFailedWebhooks();

    logger.info('Failed webhooks retry completed', result);

    res.json({
      success: true,
      data: result,
      message: 'Failed webhooks retry completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/webhooks/status:
 *   get:
 *     summary: Get webhook processing status
 *     tags: [Webhooks]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *     responses:
 *       200:
 *         description: Webhook status retrieved successfully
 */
export const getWebhookStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { hours = 24 } = req.query;

    const status = await webhookService.getWebhookStatus(Number(hours));

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/webhooks/events:
 *   get:
 *     summary: List webhook events
 *     tags: [Webhooks]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: event_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: processed
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Webhook events retrieved successfully
 */
export const listWebhookEvents = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page = 1, limit = 20, event_type, processed, start_date, end_date } = req.query;

    const result = await webhookService.listWebhookEvents({
      page: Number(page),
      limit: Number(limit),
      eventType: event_type as string,
      processed: processed === 'true' ? true : processed === 'false' ? false : undefined,
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/webhooks/events/{id}/replay:
 *   post:
 *     summary: Replay a specific webhook event
 *     tags: [Webhooks]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook event replayed successfully
 */
export const replayWebhookEvent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await webhookService.replayWebhookEvent(id);

    if (!result.found) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_EVENT_NOT_FOUND',
          message: 'Webhook event not found',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (result.alreadyProcessed) {
      res.json({
        success: true,
        message: 'Webhook event was already processed successfully',
        data: result,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info('Webhook event replayed', {
      eventId: id,
      adminUser: req.user?.email,
    });

    res.json({
      success: true,
      data: result,
      message: 'Webhook event replayed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/webhooks/metrics:
 *   get:
 *     summary: Get webhook performance metrics
 *     tags: [Webhooks]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [hour, day, week]
 *           default: day
 *     responses:
 *       200:
 *         description: Webhook metrics retrieved successfully
 */
export const getWebhookMetrics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { timeframe = 'day' } = req.query;

    const metrics = await webhookService.getWebhookMetrics(timeframe as 'hour' | 'day' | 'week');

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/webhooks/performance:
 *   get:
 *     summary: Get webhook performance statistics
 *     tags: [Webhooks]
 *     security:
 *       - BasicAuth: []
 *     responses:
 *       200:
 *         description: Performance statistics retrieved successfully
 */
export const getWebhookPerformance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const performance = await webhookService.getWebhookPerformanceStats();

    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/webhooks/cleanup:
 *   post:
 *     summary: Cleanup old webhook events
 *     tags: [Webhooks]
 *     security:
 *       - BasicAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               days_to_keep:
 *                 type: integer
 *                 default: 90
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
 */
export const cleanupWebhookEvents = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { days_to_keep = 90 } = req.body;

    const result = await webhookService.cleanupOldWebhookEvents(days_to_keep);

    logger.info('Webhook cleanup completed', {
      ...result,
      adminUser: req.user?.email,
    });

    res.json({
      success: true,
      data: result,
      message: 'Webhook cleanup completed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
