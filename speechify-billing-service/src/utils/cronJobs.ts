import cron from 'node-cron';
import { getDatabase } from '../database/connection';
import { webhookService } from '../services/webhook.service';
import { stripeService } from '../services/stripe.service';
import { emailService } from '../services/email.service';
import { logger } from './logger';

export const setupCronJobs = (): void => {
  logger.info('Setting up cron jobs...');

  // Retry failed webhooks every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      logger.info('Starting failed webhook retry job');
      await webhookService.retryFailedWebhooks();
      logger.info('Failed webhook retry job completed');
    } catch (error) {
      logger.error('Failed webhook retry job failed:', error);
    }
  });

  // Process failed payments every hour
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Starting failed payment processing job');
      await processFailedPayments();
      logger.info('Failed payment processing job completed');
    } catch (error) {
      logger.error('Failed payment processing job failed:', error);
    }
  });

  // Send trial ending notifications daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      logger.info('Starting trial ending notifications job');
      await sendTrialEndingNotifications();
      logger.info('Trial ending notifications job completed');
    } catch (error) {
      logger.error('Trial ending notifications job failed:', error);
    }
  });

  // Cleanup old usage records monthly (1st day at 2 AM)
  cron.schedule('0 2 1 * *', async () => {
    try {
      logger.info('Starting usage records cleanup job');
      await cleanupOldUsageRecords();
      logger.info('Usage records cleanup job completed');
    } catch (error) {
      logger.error('Usage records cleanup job failed:', error);
    }
  });

  // Generate monthly analytics report (1st day at 3 AM)
  cron.schedule('0 3 1 * *', async () => {
    try {
      logger.info('Starting monthly analytics job');
      await generateMonthlyAnalytics();
      logger.info('Monthly analytics job completed');
    } catch (error) {
      logger.error('Monthly analytics job failed:', error);
    }
  });

  // Health check for external services every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await performHealthChecks();
    } catch (error) {
      logger.error('Health check job failed:', error);
    }
  });

  // Sync subscription statuses with Stripe every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      logger.info('Starting subscription status sync job');
      await syncSubscriptionStatuses();
      logger.info('Subscription status sync job completed');
    } catch (error) {
      logger.error('Subscription status sync job failed:', error);
    }
  });

  logger.info('All cron jobs have been scheduled');
};

// Process failed payments and retry them
async function processFailedPayments(): Promise<void> {
  const db = getDatabase();
  
  try {
    // Get failed payments that are ready for retry
    const failedPayments = await db('failed_payments')
      .where('resolved', false)
      .where('retry_count', '<', 3)
      .where('next_retry_at', '<=', new Date())
      .orderBy('created_at',