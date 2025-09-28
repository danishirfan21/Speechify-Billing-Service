import { Router, Request, Response, NextFunction } from 'express';
import { webhookService } from '../services/webhook.service';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/billing/webhooks/stripe - Handle Stripe webhooks
router.post(
  '/stripe',
  // Use raw body parser for webhooks
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing stripe-signature header',
        });
      }

      // Process the webhook
      await webhookService.processWebhook(req.body, signature);

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
      });
    } catch (error) {
      logger.error('Webhook processing failed:', error);

      // Return 400 for webhook signature verification failures
      if (error instanceof Error && error.message.includes('signature')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook signature',
        });
      }

      // Return 500 for other errors but still acknowledge receipt
      res.status(500).json({
        success: false,
        message: 'Webhook processing failed',
      });
    }
  },
);

// POST /api/billing/webhooks/retry - Retry failed webhooks (admin only)
router.post('/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await webhookService.retryFailedWebhooks();

    res.json({
      success: true,
      message: 'Failed webhooks retry initiated',
    });
  } catch (error) {
    next(error);
  }
});

export { router as webhookRoutes };
