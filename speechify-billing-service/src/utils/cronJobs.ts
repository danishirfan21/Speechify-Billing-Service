import cron from 'node-cron';
import { getDatabase } from '../database/connection';
import { webhookService } from '../services/webhook.service';
import { stripeService } from '../services/stripe.service';
import { emailService } from '../services/email.service';
import { billingService } from '../services/billing.service';
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

  // Send dunning emails for past due subscriptions daily at 10 AM
  cron.schedule('0 10 * * *', async () => {
    try {
      logger.info('Starting dunning management job');
      await processDunningManagement();
      logger.info('Dunning management job completed');
    } catch (error) {
      logger.error('Dunning management job failed:', error);
    }
  });

  // Update subscription metrics cache every hour
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Starting metrics cache update job');
      await updateMetricsCache();
      logger.info('Metrics cache update job completed');
    } catch (error) {
      logger.error('Metrics cache update job failed:', error);
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
      .orderBy('created_at', 'asc')
      .limit(50); // Process in batches

    logger.info(`Processing ${failedPayments.length} failed payments`);

    for (const payment of failedPayments) {
      try {
        // Get customer and subscription details
        const customer = await db('customers').where('id', payment.customer_id).first();

        if (!customer) {
          logger.warn(`Customer not found for failed payment: ${payment.id}`);
          continue;
        }

        // Attempt to retry payment in Stripe
        if (payment.stripe_payment_intent_id) {
          const paymentIntent = await stripeService.retryPaymentIntent(
            payment.stripe_payment_intent_id,
          );

          if (paymentIntent.status === 'succeeded') {
            // Mark as resolved
            await db('failed_payments').where('id', payment.id).update({
              resolved: true,
              resolved_at: new Date(),
              updated_at: new Date(),
            });

            logger.info(`Failed payment resolved: ${payment.id}`);
          } else if (paymentIntent.status === 'requires_payment_method') {
            // Update retry count and schedule next retry
            const nextRetryAt = calculateNextRetryTime(payment.retry_count + 1);

            await db('failed_payments')
              .where('id', payment.id)
              .update({
                retry_count: payment.retry_count + 1,
                next_retry_at: nextRetryAt,
                updated_at: new Date(),
              });

            // Send notification if max retries reached
            if (payment.retry_count + 1 >= 3) {
              await emailService.sendPaymentFailedEmail(customer.email, {
                customerName: customer.name || 'Valued Customer',
                invoiceNumber: payment.id,
                amount: payment.amount,
                currency: payment.currency,
                dueDate: new Date(),
              });
            }
          }
        }
      } catch (error) {
        logger.error(`Failed to process payment retry ${payment.id}:`, error);

        // Update error count
        await db('failed_payments')
          .where('id', payment.id)
          .update({
            retry_count: payment.retry_count + 1,
            next_retry_at: calculateNextRetryTime(payment.retry_count + 1),
            updated_at: new Date(),
          });
      }
    }
  } catch (error) {
    logger.error('Failed to process failed payments:', error);
    throw error;
  }
}

// Send trial ending notifications
async function sendTrialEndingNotifications(): Promise<void> {
  const db = getDatabase();

  try {
    // Find subscriptions with trials ending in 3 days, 1 day, and today
    const trialEndingDates = [
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
      new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now (same day)
    ];

    for (const endDate of trialEndingDates) {
      const startOfDay = new Date(endDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      const trialSubscriptions = await db('subscriptions as s')
        .join('customers as c', 's.customer_id', 'c.id')
        .select('s.*', 'c.email', 'c.name')
        .where('s.status', 'trialing')
        .whereBetween('s.trial_end', [startOfDay, endOfDay])
        .whereNull('c.deleted_at');

      logger.info(`Found ${trialSubscriptions.length} trials ending on ${endDate.toDateString()}`);

      for (const subscription of trialSubscriptions) {
        try {
          // Check if we already sent notification for this subscription
          const existingNotification = await db('notification_logs')
            .where('subscription_id', subscription.id)
            .where('notification_type', 'trial_ending')
            .where('sent_date', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
            .first();

          if (!existingNotification) {
            await emailService.sendTrialEndingEmail(subscription.email, {
              customerName: subscription.name || 'Valued Customer',
              trialEndDate: subscription.trial_end,
              subscriptionId: subscription.id,
            });

            // Log the notification
            await db('notification_logs').insert({
              subscription_id: subscription.id,
              customer_id: subscription.customer_id,
              notification_type: 'trial_ending',
              sent_date: new Date(),
            });

            logger.info(`Trial ending notification sent to: ${subscription.email}`);
          }
        } catch (error) {
          logger.error(`Failed to send trial ending notification to ${subscription.email}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error('Failed to send trial ending notifications:', error);
    throw error;
  }
}

// Cleanup old usage records (older than 2 years)
async function cleanupOldUsageRecords(): Promise<void> {
  const db = getDatabase();

  try {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    // Archive old usage records first (move to archive table)
    const oldRecords = await db('usage_records').where('timestamp', '<', twoYearsAgo).limit(10000); // Process in batches

    if (oldRecords.length > 0) {
      // Insert into archive table
      await db('usage_records_archive').insert(oldRecords);

      // Delete from main table
      const deletedCount = await db('usage_records').where('timestamp', '<', twoYearsAgo).delete();

      logger.info(`Archived and deleted ${deletedCount} old usage records`);
    }

    // Also cleanup old webhook events (older than 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const deletedWebhooks = await db('webhook_events')
      .where('created_at', '<', sixMonthsAgo)
      .where('processed', true)
      .delete();

    logger.info(`Deleted ${deletedWebhooks} old webhook events`);

    // Cleanup resolved failed payments (older than 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const deletedFailedPayments = await db('failed_payments')
      .where('created_at', '<', oneYearAgo)
      .where('resolved', true)
      .delete();

    logger.info(`Deleted ${deletedFailedPayments} old resolved failed payments`);
  } catch (error) {
    logger.error('Failed to cleanup old usage records:', error);
    throw error;
  }
}

// Generate monthly analytics report
async function generateMonthlyAnalytics(): Promise<void> {
  const db = getDatabase();

  try {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const startOfMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const endOfMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

    // Generate comprehensive analytics report
    const analytics = await billingService.getSubscriptionAnalytics(startOfMonth, endOfMonth);
    const usageAnalytics = await billingService.getUsageAnalytics(startOfMonth, endOfMonth);

    // Calculate additional metrics
    const newCustomers = await db('customers')
      .whereBetween('created_at', [startOfMonth, endOfMonth])
      .count('id as count')
      .first();

    const churned = await db('subscriptions')
      .where('status', 'canceled')
      .whereBetween('canceled_at', [startOfMonth, endOfMonth])
      .count('id as count')
      .first();

    const report = {
      period: {
        start: startOfMonth,
        end: endOfMonth,
        month: lastMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
      },
      metrics: {
        ...analytics,
        ...usageAnalytics,
        new_customers: parseInt(newCustomers?.count || '0'),
        churned_customers: parseInt(churned?.count || '0'),
      },
      generated_at: new Date(),
    };

    // Store report in database
    await db('analytics_reports').insert({
      report_type: 'monthly',
      period_start: startOfMonth,
      period_end: endOfMonth,
      data: JSON.stringify(report),
      created_at: new Date(),
    });

    // Send report to admin team
    await emailService.sendMonthlyReport('admin@speechify.com', report);

    logger.info(`Monthly analytics report generated for ${report.period.month}`);
  } catch (error) {
    logger.error('Failed to generate monthly analytics:', error);
    throw error;
  }
}

// Perform health checks on external services
async function performHealthChecks(): Promise<void> {
  try {
    const healthResults = await billingService.getSystemHealth();

    // Log unhealthy services
    if (healthResults.status === 'unhealthy') {
      logger.warn('System health check failed', healthResults);

      // Send alert if multiple failures
      const failedComponents = Object.entries(healthResults.components)
        .filter(([_, component]: [string, any]) => component.status !== 'healthy')
        .map(([name]) => name);

      if (failedComponents.length > 1) {
        logger.error('Multiple system components unhealthy', {
          failedComponents,
          timestamp: new Date(),
        });
      }
    }

    // Store health check results
    const db = getDatabase();
    await db('health_check_logs').insert({
      overall_status: healthResults.status,
      components: JSON.stringify(healthResults.components),
      metrics: JSON.stringify(healthResults.metrics),
      checked_at: new Date(),
    });
  } catch (error) {
    logger.error('Health check failed:', error);
  }
}

// Sync subscription statuses with Stripe
async function syncSubscriptionStatuses(): Promise<void> {
  const db = getDatabase();

  try {
    // Get active subscriptions that might need status sync
    const subscriptions = await db('subscriptions')
      .whereIn('status', ['active', 'trialing', 'past_due'])
      .where('updated_at', '<', new Date(Date.now() - 6 * 60 * 60 * 1000)) // Not updated in last 6 hours
      .limit(100); // Process in batches

    logger.info(`Syncing ${subscriptions.length} subscription statuses with Stripe`);

    for (const subscription of subscriptions) {
      try {
        // Get latest status from Stripe
        const stripeSubscription = await stripeService.getSubscription(
          subscription.stripe_subscription_id,
        );

        // Update local database if status differs
        if (stripeSubscription.status !== subscription.status) {
          await db('subscriptions')
            .where('id', subscription.id)
            .update({
              status: stripeSubscription.status,
              current_period_start: new Date(stripeSubscription.current_period_start * 1000),
              current_period_end: new Date(stripeSubscription.current_period_end * 1000),
              updated_at: new Date(),
            });

          logger.info(
            `Updated subscription ${subscription.id} status: ${subscription.status} -> ${stripeSubscription.status}`,
          );
        }
      } catch (error) {
        logger.error(`Failed to sync subscription ${subscription.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Failed to sync subscription statuses:', error);
    throw error;
  }
}

// Process dunning management for past due subscriptions
async function processDunningManagement(): Promise<void> {
  const db = getDatabase();

  try {
    // Get past due subscriptions
    const pastDueSubscriptions = await db('subscriptions as s')
      .join('customers as c', 's.customer_id', 'c.id')
      .select('s.*', 'c.email', 'c.name')
      .where('s.status', 'past_due')
      .whereNull('c.deleted_at');

    logger.info(`Processing dunning for ${pastDueSubscriptions.length} past due subscriptions`);

    for (const subscription of pastDueSubscriptions) {
      try {
        // Check how long the subscription has been past due
        const daysPastDue = Math.floor(
          (Date.now() - subscription.current_period_end.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Get latest failed payment for this subscription
        const latestFailedPayment = await db('failed_payments')
          .where('subscription_id', subscription.id)
          .where('resolved', false)
          .orderBy('created_at', 'desc')
          .first();

        // Dunning schedule: Day 1, 3, 7, 14, then cancel
        const shouldSendEmail = [1, 3, 7, 14].includes(daysPastDue);

        if (shouldSendEmail) {
          // Check if we already sent email for this day
          const existingNotification = await db('notification_logs')
            .where('subscription_id', subscription.id)
            .where('notification_type', 'dunning')
            .where('sent_date', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
            .first();

          if (!existingNotification) {
            await emailService.sendDunningEmail(subscription.email, {
              customerName: subscription.name || 'Valued Customer',
              subscriptionId: subscription.id,
              daysPastDue,
              amount: latestFailedPayment?.amount || 0,
              currency: latestFailedPayment?.currency || 'usd',
            });

            // Log the notification
            await db('notification_logs').insert({
              subscription_id: subscription.id,
              customer_id: subscription.customer_id,
              notification_type: 'dunning',
              sent_date: new Date(),
              metadata: JSON.stringify({ daysPastDue }),
            });

            logger.info(
              `Dunning email sent to ${subscription.email} (${daysPastDue} days past due)`,
            );
          }
        }

        // Cancel subscription if past due for more than 14 days
        if (daysPastDue > 14) {
          await billingService.cancelSubscription(subscription.id, true);

          await emailService.sendSubscriptionCanceledEmail(subscription.email, {
            customerName: subscription.name || 'Valued Customer',
            subscriptionId: subscription.id,
            canceledAt: new Date(),
          });

          logger.warn(`Subscription ${subscription.id} canceled due to prolonged past due status`);
        }
      } catch (error) {
        logger.error(`Failed to process dunning for subscription ${subscription.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Failed to process dunning management:', error);
    throw error;
  }
}

// Update metrics cache for dashboard performance
async function updateMetricsCache(): Promise<void> {
  const db = getDatabase();

  try {
    // Calculate key metrics
    const [totalRevenue, totalCustomers, activeSubscriptions, mrr] = await Promise.all([
      db('invoices').where('status', 'paid').sum('amount_paid as total').first(),
      db('customers').whereNull('deleted_at').count('id as count').first(),
      db('subscriptions').whereIn('status', ['active', 'trialing']).count('id as count').first(),
      db('subscriptions as s')
        .join('subscription_plans as sp', 's.plan_id', 'sp.id')
        .whereIn('s.status', ['active', 'trialing'])
        .sum(
          db.raw(`
          CASE 
            WHEN sp.billing_interval = 'year' THEN sp.amount / 12 
            ELSE sp.amount 
          END * s.quantity
        `),
        )
        .first(),
    ]);

    // Calculate churn rate (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [churned, totalAtStart] = await Promise.all([
      db('subscriptions')
        .where('status', 'canceled')
        .where('canceled_at', '>=', thirtyDaysAgo)
        .count('id as count')
        .first(),
      db('subscriptions').where('created_at', '<=', thirtyDaysAgo).count('id as count').first(),
    ]);

    const churnRate =
      parseInt(totalAtStart?.count || '0') > 0
        ? (parseInt(churned?.count || '0') / parseInt(totalAtStart.count)) * 100
        : 0;

    const metrics = {
      total_revenue: parseFloat(totalRevenue?.total || '0'),
      total_customers: parseInt(totalCustomers?.count || '0'),
      active_subscriptions: parseInt(activeSubscriptions?.count || '0'),
      mrr: parseFloat(mrr || '0'),
      arr: parseFloat(mrr || '0') * 12,
      churn_rate: parseFloat(churnRate.toFixed(2)),
      last_updated: new Date(),
    };

    // Store in cache table
    await db('metrics_cache')
      .insert({
        cache_key: 'dashboard_metrics',
        data: JSON.stringify(metrics),
        expires_at: new Date(Date.now() + 60 * 60 * 1000), // Cache for 1 hour
        created_at: new Date(),
      })
      .onConflict('cache_key')
      .merge(['data', 'expires_at', 'created_at']);

    logger.debug('Metrics cache updated successfully');
  } catch (error) {
    logger.error('Failed to update metrics cache:', error);
    throw error;
  }
}

// Helper function to calculate next retry time
function calculateNextRetryTime(retryCount: number): Date {
  // Exponential backoff: 1 hour, 6 hours, 24 hours
  let hoursToAdd: number;
  switch (retryCount) {
    case 1:
      hoursToAdd = 1;
      break;
    case 2:
      hoursToAdd = 6;
      break;
    case 3:
      hoursToAdd = 24;
      break;
    default:
      hoursToAdd = 24;
  }

  return new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);
}
