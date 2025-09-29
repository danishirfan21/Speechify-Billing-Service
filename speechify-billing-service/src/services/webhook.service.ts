import Stripe from 'stripe';
import { getDatabase } from '../database/connection';
import { stripeService } from './stripe.service';
import { billingService } from './billing.service';
import { emailService } from './email.service';
import { logger } from '../utils/logger';
import { WebhookEvent, StripeWebhookEvent } from '../types';

interface WebhookDatabase {
  (table: string): any;
}

export class WebhookService {
  private db = getDatabase();

  constructor(database: WebhookDatabase) {
    this.db = database;
  }

  async processWebhook(payload: string | Buffer, signature: string): Promise<void> {
    try {
      // Verify and construct the event
      const event = stripeService.constructEvent(payload, signature);

      // Check if we've already processed this event
      const existingEvent = await this.db('webhook_events')
        .where('stripe_event_id', event.id)
        .first();

      if (existingEvent) {
        logger.info(`Event ${event.id} already processed, skipping`);
        return;
      }

      // Save the event to database
      await this.saveWebhookEvent(event);

      // Process the event based on type
      await this.handleEvent(event);

      // Mark as processed
      await this.markEventProcessed(event.id);

      logger.info(`Successfully processed webhook event: ${event.type} (${event.id})`);
    } catch (error) {
      logger.error('Failed to process webhook:', error);

      // Save failed event for retry
      if (error instanceof Error) {
        await this.saveFailedWebhookEvent(payload.toString(), error.message);
      }

      throw error;
    }
  }

  private async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      // Customer events
      case 'customer.created':
        await this.handleCustomerCreated(event);
        break;
      case 'customer.updated':
        await this.handleCustomerUpdated(event);
        break;
      case 'customer.deleted':
        await this.handleCustomerDeleted(event);
        break;

      // Subscription events
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event);
        break;
      case 'customer.subscription.trial_will_end':
        await this.handleTrialWillEnd(event);
        break;

      // Invoice events
      case 'invoice.created':
        await this.handleInvoiceCreated(event);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event);
        break;
      case 'invoice.upcoming':
        await this.handleInvoiceUpcoming(event);
        break;

      // Payment events
      case 'payment_method.attached':
        await this.handlePaymentMethodAttached(event);
        break;
      case 'payment_method.detached':
        await this.handlePaymentMethodDetached(event);
        break;
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event);
        break;

      // Charge events
      case 'charge.dispute.created':
        await this.handleChargeDisputeCreated(event);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }
  }

  // Customer event handlers
  private async handleCustomerCreated(event: Stripe.Event): Promise<void> {
    const customer = event.data.object as Stripe.Customer;
    logger.info(`Customer created webhook: ${customer.id}`);
    // Customer creation is typically handled by the API endpoint
    // This webhook can be used for additional processing or syncing
  }

  private async handleCustomerUpdated(event: Stripe.Event): Promise<void> {
    const customer = event.data.object as Stripe.Customer;

    try {
      const dbCustomer = await billingService.getCustomerByStripeId(customer.id);
      if (dbCustomer) {
        await this.db('customers').where('stripe_customer_id', customer.id).update({
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          updated_at: new Date(),
        });

        logger.info(`Customer updated in database: ${customer.id}`);
      }
    } catch (error) {
      logger.error(`Failed to update customer ${customer.id}:`, error);
      throw error;
    }
  }

  private async handleCustomerDeleted(event: Stripe.Event): Promise<void> {
    const customer = event.data.object as Stripe.Customer;

    try {
      await this.db('customers').where('stripe_customer_id', customer.id).update({
        deleted_at: new Date(),
        updated_at: new Date(),
      });

      logger.info(`Customer soft deleted: ${customer.id}`);
    } catch (error) {
      logger.error(`Failed to delete customer ${customer.id}:`, error);
      throw error;
    }
  }

  // Subscription event handlers
  private async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    logger.info(`Subscription created webhook: ${subscription.id}`);

    // Send welcome email
    try {
      const customer = await billingService.getCustomerByStripeId(subscription.customer as string);
      if (customer?.email) {
        await emailService.sendWelcomeEmail(customer.email, {
          customerName: customer.name || 'Valued Customer',
          subscriptionId: subscription.id,
        });
      }
    } catch (error) {
      logger.error(`Failed to send welcome email for subscription ${subscription.id}:`, error);
    }
  }

  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
  const previousAttributes = event.data.previous_attributes as Record<string, unknown>;

    try {
      const dbSubscription = await this.db('subscriptions')
        .where('stripe_subscription_id', subscription.id)
        .first();

      if (dbSubscription) {
        await this.db('subscriptions')
          .where('stripe_subscription_id', subscription.id)
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000),
            trial_start: subscription.trial_start
              ? new Date(subscription.trial_start * 1000)
              : null,
            trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
            canceled_at: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000)
              : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date(),
          });

        logger.info(`Subscription updated in database: ${subscription.id}`);

        // Send notifications for important status changes
        const customer = await billingService.getCustomerByStripeId(
          subscription.customer as string,
        );
        if (customer?.email) {
          if (previousAttributes?.status && subscription.status !== previousAttributes.status) {
            await this.handleSubscriptionStatusChange(
              customer.email,
              subscription,
              previousAttributes.status,
            );
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to update subscription ${subscription.id}:`, error);
      throw error;
    }
  }

  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    try {
      await this.db('subscriptions').where('stripe_subscription_id', subscription.id).update({
        status: 'canceled',
        canceled_at: new Date(),
        updated_at: new Date(),
      });

      // Send cancellation email
      const customer = await billingService.getCustomerByStripeId(subscription.customer as string);
      if (customer?.email) {
        await emailService.sendSubscriptionCanceledEmail(customer.email, {
          customerName: customer.name || 'Valued Customer',
          subscriptionId: subscription.id,
          canceledAt: new Date(),
        });
      }

      logger.info(`Subscription canceled: ${subscription.id}`);
    } catch (error) {
      logger.error(`Failed to handle subscription deletion ${subscription.id}:`, error);
      throw error;
    }
  }

  private async handleTrialWillEnd(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    try {
      const customer = await billingService.getCustomerByStripeId(subscription.customer as string);
      if (customer?.email && subscription.trial_end) {
        await emailService.sendTrialEndingEmail(customer.email, {
          customerName: customer.name || 'Valued Customer',
          trialEndDate: new Date(subscription.trial_end * 1000),
          subscriptionId: subscription.id,
        });
      }

      logger.info(`Trial ending notification sent for subscription: ${subscription.id}`);
    } catch (error) {
      logger.error(`Failed to handle trial will end for ${subscription.id}:`, error);
      throw error;
    }
  }

  // Invoice event handlers
  private async handleInvoiceCreated(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    try {
      const customer = await billingService.getCustomerByStripeId(invoice.customer as string);
      if (customer) {
        await billingService.saveInvoice({
          stripe_invoice_id: invoice.id,
          customer_id: customer.id,
          subscription_id: invoice.subscription
            ? (
                await this.getSubscriptionByStripeId(invoice.subscription as string)
              )?.id
            : undefined,
          invoice_number: invoice.number,
          status: String(invoice.status),
          amount_due: invoice.amount_due / 100,
          amount_paid: invoice.amount_paid / 100,
          amount_remaining: invoice.amount_remaining / 100,
          currency: String(invoice.currency),
          due_date: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
          hosted_invoice_url: invoice.hosted_invoice_url,
          invoice_pdf_url: invoice.invoice_pdf,
          metadata: invoice.metadata,
        });

        logger.info(`Invoice saved to database: ${invoice.id}`);
      }
    } catch (error) {
      logger.error(`Failed to handle invoice created ${invoice.id}:`, error);
      throw error;
    }
  }

  private async handleInvoicePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    try {
      await this.db('invoices')
        .where('stripe_invoice_id', invoice.id)
        .update({
          status: 'paid',
          amount_paid: invoice.amount_paid / 100,
          amount_remaining: invoice.amount_remaining / 100,
          paid_at: new Date(),
          updated_at: new Date(),
        });

      // Send payment confirmation email
      const customer = await billingService.getCustomerByStripeId(invoice.customer as string);
      if (customer?.email) {
        await emailService.sendPaymentSuccessEmail(customer.email, {
          customerName: customer.name || 'Valued Customer',
          invoiceNumber: invoice.number || invoice.id,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
          paidAt: new Date(),
          invoiceUrl: invoice.hosted_invoice_url,
        });
      }

      logger.info(`Invoice payment succeeded: ${invoice.id}`);
    } catch (error) {
      logger.error(`Failed to handle invoice payment succeeded ${invoice.id}:`, error);
      throw error;
    }
  }

  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    try {
      await this.db('invoices').where('stripe_invoice_id', invoice.id).update({
        status: 'open',
        updated_at: new Date(),
      });

      // Record failed payment
      const customer = await billingService.getCustomerByStripeId(invoice.customer as string);
      if (customer) {
        await this.db('failed_payments').insert({
          customer_id: customer.id,
          subscription_id: invoice.subscription
            ? (
                await this.getSubscriptionByStripeId(invoice.subscription as string)
              )?.id
            : undefined,
          amount: invoice.amount_due / 100,
          currency: invoice.currency,
          failure_reason: 'Invoice payment failed',
          retry_count: 0,
          next_retry_at: this.calculateNextRetry(0),
        });

        // Send payment failed email
        if (customer.email) {
          await emailService.sendPaymentFailedEmail(customer.email, {
            customerName: customer.name || 'Valued Customer',
            invoiceNumber: invoice.number || invoice.id,
            amount: invoice.amount_due / 100,
            currency: invoice.currency,
            dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : new Date(),
            invoiceUrl: invoice.hosted_invoice_url,
          });
        }
      }

      logger.info(`Invoice payment failed: ${invoice.id}`);
    } catch (error) {
      logger.error(`Failed to handle invoice payment failed ${invoice.id}:`, error);
      throw error;
    }
  }

  private async handleInvoiceUpcoming(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    try {
      const customer = await billingService.getCustomerByStripeId(invoice.customer as string);
      if (customer?.email) {
        await emailService.sendUpcomingInvoiceEmail(customer.email, {
          customerName: customer.name || 'Valued Customer',
          amount: invoice.amount_due / 100,
          currency: invoice.currency,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : new Date(),
        });
      }

      logger.info(`Upcoming invoice notification sent: ${invoice.id}`);
    } catch (error) {
      logger.error(`Failed to handle upcoming invoice ${invoice.id}:`, error);
      throw error;
    }
  }

  // Payment method handlers
  private async handlePaymentMethodAttached(event: Stripe.Event): Promise<void> {
    const paymentMethod = event.data.object as Stripe.PaymentMethod;

    try {
      const customer = await billingService.getCustomerByStripeId(paymentMethod.customer as string);
      if (customer && paymentMethod.card) {
        await billingService.savePaymentMethod({
          stripe_payment_method_id: paymentMethod.id,
          customer_id: customer.id,
          type: paymentMethod.type,
          card_brand: paymentMethod.card.brand,
          card_last_four: paymentMethod.card.last4,
          card_exp_month: paymentMethod.card.exp_month,
          card_exp_year: paymentMethod.card.exp_year,
          is_default: false,
        });

        logger.info(`Payment method saved: ${paymentMethod.id}`);
      }
    } catch (error) {
      logger.error(`Failed to handle payment method attached ${paymentMethod.id}:`, error);
      throw error;
    }
  }

  private async handlePaymentMethodDetached(event: Stripe.Event): Promise<void> {
    const paymentMethod = event.data.object as Stripe.PaymentMethod;

    try {
      await this.db('payment_methods').where('stripe_payment_method_id', paymentMethod.id).delete();

      logger.info(`Payment method removed: ${paymentMethod.id}`);
    } catch (error) {
      logger.error(`Failed to handle payment method detached ${paymentMethod.id}:`, error);
      throw error;
    }
  }

  // Payment intent handlers
  private async handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    logger.info(`Payment intent succeeded: ${paymentIntent.id}`);
  }

  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    try {
      const customer = await billingService.getCustomerByStripeId(paymentIntent.customer as string);
      if (customer) {
        await this.db('failed_payments').insert({
          customer_id: customer.id,
          stripe_payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          failure_reason: paymentIntent.last_payment_error?.message,
          failure_code: paymentIntent.last_payment_error?.code,
          retry_count: 0,
          next_retry_at: this.calculateNextRetry(0),
        });
      }

      logger.info(`Payment intent failed recorded: ${paymentIntent.id}`);
    } catch (error) {
      logger.error(`Failed to handle payment intent failed ${paymentIntent.id}:`, error);
      throw error;
    }
  }

  // Dispute handlers
  private async handleChargeDisputeCreated(event: Stripe.Event): Promise<void> {
    const dispute = event.data.object as Stripe.Dispute;
    logger.warn(`Dispute created: ${dispute.id} for charge: ${dispute.charge}`);

    // Here you would typically notify administrators about the dispute
    // and potentially pause the customer's service
  }

  // Helper methods
  private async handleSubscriptionStatusChange(
    customerEmail: string,
    subscription: Stripe.Subscription,
    previousStatus: string,
  ): Promise<void> {
    const customer = await billingService.getCustomerByStripeId(subscription.customer as string);
    if (!customer) return;

    switch (subscription.status) {
      case 'active':
        if (previousStatus === 'trialing') {
          await emailService.sendTrialConvertedEmail(customerEmail, {
            customerName: customer.name || 'Valued Customer',
            subscriptionId: subscription.id,
          });
        }
        break;
      case 'past_due':
        await emailService.sendPaymentFailedEmail(customerEmail, {
          customerName: customer.name || 'Valued Customer',
          invoiceNumber: '',
          amount: 0,
          currency: 'usd',
          dueDate: new Date(),
          invoiceUrl: '',
        });
        break;
      case 'canceled':
        await emailService.sendSubscriptionCanceledEmail(customerEmail, {
          customerName: customer.name || 'Valued Customer',
          subscriptionId: subscription.id,
          canceledAt: new Date(),
        });
        break;
    }
  }

  private async getSubscriptionByStripeId(stripeSubscriptionId: string) {
    return await this.db('subscriptions')
      .where('stripe_subscription_id', stripeSubscriptionId)
      .first();
  }

  private calculateNextRetry(retryCount: number): Date {
    // Exponential backoff: 1 hour, 24 hours, 72 hours
    const hours = retryCount === 0 ? 1 : retryCount === 1 ? 24 : 72;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private async saveWebhookEvent(event: Stripe.Event): Promise<void> {
    await this.db('webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      data: JSON.stringify(event.data),
      processed: false,
      retry_count: 0,
    });
  }

  private async saveFailedWebhookEvent(payload: string, errorMessage: string): Promise<void> {
    try {
      const data = JSON.parse(payload);
      await this.db('webhook_events').insert({
        stripe_event_id: data.id || 'unknown',
        event_type: data.type || 'unknown',
        data: payload,
        processed: false,
        error_message: errorMessage,
        retry_count: 1,
      });
    } catch (error) {
      logger.error('Failed to save failed webhook event:', error);
    }
  }

  private async markEventProcessed(eventId: string): Promise<void> {
    await this.db('webhook_events').where('stripe_event_id', eventId).update({
      processed: true,
      processed_at: new Date(),
    });
  }

  // Retry failed webhooks
  async retryFailedWebhooks(): Promise<void> {
    try {
      const failedEvents = await this.db('webhook_events')
        .where('processed', false)
        .where('retry_count', '<', 3)
        .where('created_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)); // Last 24 hours

      for (const failedEvent of failedEvents) {
        try {
          const event = JSON.parse(failedEvent.data);
          await this.handleEvent(event);
          await this.markEventProcessed(failedEvent.stripe_event_id);

          logger.info(`Successfully retried webhook event: ${failedEvent.stripe_event_id}`);
        } catch (error) {
          await this.db('webhook_events')
            .where('id', failedEvent.id)
            .update({
              retry_count: failedEvent.retry_count + 1,
              error_message: error instanceof Error ? error.message : 'Unknown error',
            });

          logger.error(`Failed to retry webhook event ${failedEvent.stripe_event_id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to retry failed webhooks:', error);
      throw error;
    }
  }

  // Get webhook processing status and statistics
  async getWebhookStatus(hoursBack: number = 24): Promise<Record<string, unknown>> {
    try {
      const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const [
        totalEvents,
        processedEvents,
        failedEvents,
        eventsByType,
        recentFailures,
        avgProcessingTime,
      ] = await Promise.all([
        // Total events in time period
        this.db('webhook_events').where('created_at', '>=', startTime).count('id as count').first(),

        // Successfully processed events
        this.db('webhook_events')
          .where('created_at', '>=', startTime)
          .where('processed', true)
          .whereNull('error_message')
          .count('id as count')
          .first(),

        // Failed events
        this.db('webhook_events')
          .where('created_at', '>=', startTime)
          .where(function () {
            this.where('processed', false).orWhereNotNull('error_message');
          })
          .count('id as count')
          .first(),

        // Events by type
        this.db('webhook_events')
          .select('event_type')
          .count('id as count')
          .where('created_at', '>=', startTime)
          .groupBy('event_type')
          .orderBy('count', 'desc'),

        // Recent failures
        this.db('webhook_events')
          .select('stripe_event_id', 'event_type', 'error_message', 'retry_count', 'created_at')
          .where('created_at', '>=', startTime)
          .whereNotNull('error_message')
          .orderBy('created_at', 'desc')
          .limit(10),

        // Average processing time (mock calculation)
        this.db('webhook_events')
          .where('created_at', '>=', startTime)
          .where('processed', true)
          .avg('retry_count as avg_retries')
          .first(),
      ]);

      const total = parseInt(totalEvents?.count || '0');
      const processed = parseInt(processedEvents?.count || '0');
      const failed = parseInt(failedEvents?.count || '0');

      return {
        time_period: `${hoursBack} hours`,
        total_events: total,
        processed_events: processed,
        failed_events: failed,
        processing_rate: total > 0 ? Math.round((processed / total) * 100) : 100,
        average_processing_time: Math.round((avgProcessingTime?.avg_retries || 0) * 100), // Mock calculation
        events_by_type: eventsByType.reduce((acc, event) => {
          acc[event.event_type] = parseInt(event.count);
          return acc;
        }, {} as Record<string, number>),
        recent_failures: recentFailures.map((failure) => ({
          event_id: failure.stripe_event_id,
          event_type: failure.event_type,
          error: failure.error_message,
          retry_count: failure.retry_count,
          failed_at: failure.created_at,
        })),
        health_status:
          failed < total * 0.1 ? 'healthy' : failed < total * 0.25 ? 'degraded' : 'unhealthy',
      };
    } catch (error) {
      logger.error('Failed to get webhook status:', error);
      throw error;
    }
  }

  // List webhook events with filtering
  async listWebhookEvents(options: {
    page: number;
    limit: number;
    eventType?: string;
    processed?: boolean;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Record<string, unknown>> {
    try {
      const { page, limit, eventType, processed, startDate, endDate } = options;
      const offset = (page - 1) * limit;

      let query = this.db('webhook_events').select('*');

      if (eventType) {
        query = query.where('event_type', eventType);
      }

      if (processed !== undefined) {
        query = query.where('processed', processed);
      }

      if (startDate) {
        query = query.where('created_at', '>=', startDate);
      }

      if (endDate) {
        query = query.where('created_at', '<=', endDate);
      }

      const [events, totalResult] = await Promise.all([
        query.clone().orderBy('created_at', 'desc').limit(limit).offset(offset),
        query.clone().count('id as count').first(),
      ]);

      const total = parseInt(totalResult?.count || '0');
      const totalPages = Math.ceil(total / limit);

      return {
        events: events.map((event) => ({
          id: event.id,
          stripe_event_id: event.stripe_event_id,
          event_type: event.event_type,
          processed: event.processed,
          processed_at: event.processed_at,
          error_message: event.error_message,
          retry_count: event.retry_count,
          created_at: event.created_at,
          data_preview: this.truncateEventData(event.data),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to list webhook events:', error);
      throw error;
    }
  }

  // Replay a specific webhook event
  async replayWebhookEvent(eventId: string): Promise<Record<string, unknown>> {
    try {
      // Try to find by Stripe event ID first, then by internal ID
      let webhookEvent = await this.db('webhook_events').where('stripe_event_id', eventId).first();

      if (!webhookEvent) {
        webhookEvent = await this.db('webhook_events').where('id', eventId).first();
      }

      if (!webhookEvent) {
        return {
          found: false,
          alreadyProcessed: false,
        };
      }

      if (webhookEvent.processed && !webhookEvent.error_message) {
        return {
          found: true,
          alreadyProcessed: true,
        };
      }

      // Reset the event for reprocessing
      await this.db('webhook_events').where('id', webhookEvent.id).update({
        processed: false,
        processed_at: null,
        error_message: null,
        retry_count: 0,
      });

      // Process the event
      const eventData = JSON.parse(webhookEvent.data);
      await this.handleEvent(eventData);
      await this.markEventProcessed(webhookEvent.stripe_event_id);

      logger.info(`Webhook event replayed successfully: ${eventId}`);

      return {
        found: true,
        alreadyProcessed: false,
        replayed: true,
      };
    } catch (error) {
      logger.error(`Failed to replay webhook event ${eventId}:`, error);

      // Mark as failed
      await this.db('webhook_events')
        .where('stripe_event_id', eventId)
        .orWhere('id', eventId)
        .update({
          error_message: error instanceof Error ? error.message : 'Replay failed',
          retry_count: this.db.raw('retry_count + 1'),
        });

      throw error;
    }
  }

  // Enhanced retry failed webhooks with better error handling
  async retryFailedWebhooks(): Promise<Record<string, unknown>> {
    try {
      const failedEvents = await this.db('webhook_events')
        .where('processed', false)
        .where('retry_count', '<', 3)
        .where('created_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
        .orderBy('created_at', 'asc')
        .limit(50); // Process in batches

      let retriedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const failedEvent of failedEvents) {
        try {
          const eventData = JSON.parse(failedEvent.data);
          await this.handleEvent(eventData);
          await this.markEventProcessed(failedEvent.stripe_event_id);
          retriedCount++;

          logger.info(`Successfully retried webhook event: ${failedEvent.stripe_event_id}`);
        } catch (error) {
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${failedEvent.stripe_event_id}: ${errorMessage}`);

          await this.db('webhook_events')
            .where('id', failedEvent.id)
            .update({
              retry_count: failedEvent.retry_count + 1,
              error_message: errorMessage,
            });

          logger.error(`Failed to retry webhook event ${failedEvent.stripe_event_id}:`, error);
        }
      }

      return {
        total_attempted: failedEvents.length,
        retried_successfully: retriedCount,
        failed_retry: failedCount,
        errors: errors.slice(0, 10), // Limit error list
      };
    } catch (error) {
      logger.error('Failed to retry failed webhooks:', error);
      throw error;
    }
  }

  // Webhook event data processing helpers
  private truncateEventData(data: Record<string, unknown>): Record<string, unknown> {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;

      // Return a truncated version for preview
      return {
        id: parsed.id,
        type: parsed.type,
        object: parsed.data?.object?.object,
        created: parsed.created,
        // Truncate large data fields
        data_size: JSON.stringify(parsed).length,
      };
    } catch (error) {
      return { error: 'Failed to parse event data' };
    }
  }

  // Abstract method placeholders (these should be implemented in the main WebhookService)
  private async handleEvent(event: WebhookEvent): Promise<void> {
    // This method should be implemented in the main WebhookService class
    throw new Error('handleEvent method must be implemented');
  }

  private async markEventProcessed(eventId: string): Promise<void> {
    await this.db('webhook_events').where('stripe_event_id', eventId).update({
      processed: true,
      processed_at: new Date(),
    });
  }

  // Webhook metrics collection
  async getWebhookMetrics(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<Record<string, unknown>> {
    try {
      let timeInterval: string;
      let startTime: Date;

      switch (timeframe) {
        case 'hour':
          timeInterval = "DATE_TRUNC('hour', created_at)";
          startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
          break;
        case 'week':
          timeInterval = "DATE_TRUNC('day', created_at)";
          startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
          break;
        default:
          timeInterval = "DATE_TRUNC('day', created_at)";
          startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
      }

      const metrics = await this.db('webhook_events')
        .select(
          this.db.raw(`${timeInterval} as time_bucket`),
          this.db.raw('COUNT(*) as total_events'),
          this.db.raw(
            'COUNT(CASE WHEN processed = true AND error_message IS NULL THEN 1 END) as successful_events',
          ),
          this.db.raw(
            'COUNT(CASE WHEN processed = false OR error_message IS NOT NULL THEN 1 END) as failed_events',
          ),
          this.db.raw('AVG(retry_count) as avg_retry_count'),
        )
        .where('created_at', '>=', startTime)
        .groupBy(this.db.raw(timeInterval))
        .orderBy('time_bucket', 'asc');

      const processedMetrics = metrics.map((metric) => ({
        timestamp: metric.time_bucket,
        total_events: parseInt(metric.total_events),
        successful_events: parseInt(metric.successful_events),
        failed_events: parseInt(metric.failed_events),
        success_rate:
          metric.total_events > 0
            ? Math.round((metric.successful_events / metric.total_events) * 100)
            : 100,
        avg_retry_count: parseFloat(metric.avg_retry_count || '0'),
      }));

      return {
        timeframe,
        start_time: startTime,
        metrics: processedMetrics,
        summary: {
          total_events: processedMetrics.reduce((sum, m) => sum + m.total_events, 0),
          total_successful: processedMetrics.reduce((sum, m) => sum + m.successful_events, 0),
          total_failed: processedMetrics.reduce((sum, m) => sum + m.failed_events, 0),
          overall_success_rate:
            processedMetrics.length > 0
              ? Math.round(
                  processedMetrics.reduce((sum, m) => sum + m.success_rate, 0) /
                    processedMetrics.length,
                )
              : 100,
        },
      };
    } catch (error) {
      logger.error('Failed to get webhook metrics:', error);
      throw error;
    }
  }

  // Webhook event cleanup
  async cleanupOldWebhookEvents(daysToKeep: number = 90): Promise<Record<string, unknown>> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      // Archive processed events older than cutoff
      const eventsToArchive = await this.db('webhook_events')
        .where('created_at', '<', cutoffDate)
        .where('processed', true)
        .whereNull('error_message');

      let archivedCount = 0;
      if (eventsToArchive.length > 0) {
        // In a real implementation, you might move these to an archive table
        archivedCount = await this.db('webhook_events')
          .where('created_at', '<', cutoffDate)
          .where('processed', true)
          .whereNull('error_message')
          .delete();
      }

      // Keep failed events longer for debugging
      const failedCutoffDate = new Date(Date.now() - daysToKeep * 2 * 24 * 60 * 60 * 1000);
      const deletedFailedCount = await this.db('webhook_events')
        .where('created_at', '<', failedCutoffDate)
        .delete();

      return {
        cleanup_date: new Date(),
        cutoff_date: cutoffDate,
        archived_processed_events: archivedCount,
        deleted_failed_events: deletedFailedCount,
        total_cleaned: archivedCount + deletedFailedCount,
      };
    } catch (error) {
      logger.error('Failed to cleanup old webhook events:', error);
      throw error;
    }
  }

  // Webhook performance monitoring
  async getWebhookPerformanceStats(): Promise<Record<string, unknown>> {
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [last24HoursStats, last7DaysStats, slowestEvents, mostFailedTypes] = await Promise.all([
        this.getStatsForPeriod(last24Hours),
        this.getStatsForPeriod(last7Days),
        this.getSlowestEvents(),
        this.getMostFailedEventTypes(),
      ]);

      return {
        last_24_hours: last24HoursStats,
        last_7_days: last7DaysStats,
        slowest_events: slowestEvents,
        most_failed_types: mostFailedTypes,
        recommendations: this.generatePerformanceRecommendations(last24HoursStats, mostFailedTypes),
      };
    } catch (error) {
      logger.error('Failed to get webhook performance stats:', error);
      throw error;
    }
  }

  private async getStatsForPeriod(startDate: Date): Promise<Record<string, unknown>> {
    const stats = await this.db('webhook_events')
      .select(
        this.db.raw('COUNT(*) as total'),
        this.db.raw('COUNT(CASE WHEN processed = true THEN 1 END) as processed'),
        this.db.raw('COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as failed'),
        this.db.raw('AVG(retry_count) as avg_retries'),
        this.db.raw('MAX(retry_count) as max_retries'),
      )
      .where('created_at', '>=', startDate)
      .first();

    const total = parseInt(stats?.total || '0');
    const processed = parseInt(stats?.processed || '0');
    const failed = parseInt(stats?.failed || '0');

    return {
      total_events: total,
      processed_events: processed,
      failed_events: failed,
      success_rate: total > 0 ? Math.round((processed / total) * 100) : 100,
      failure_rate: total > 0 ? Math.round((failed / total) * 100) : 0,
      avg_retries: parseFloat(stats?.avg_retries || '0'),
      max_retries: parseInt(stats?.max_retries || '0'),
    };
  }

  private async getSlowestEvents(): Promise<any[]> {
    // This would require tracking processing time in the database
    // For now, return events with highest retry counts as proxy
    const slowEvents = await this.db('webhook_events')
      .select('stripe_event_id', 'event_type', 'retry_count', 'created_at', 'processed_at')
      .where('processed', true)
      .where('retry_count', '>', 0)
      .orderBy('retry_count', 'desc')
      .limit(10);

    return slowEvents.map((event) => ({
      event_id: event.stripe_event_id,
      event_type: event.event_type,
      retry_count: event.retry_count,
      processing_time_estimate: event.retry_count * 1000, // Mock calculation
      created_at: event.created_at,
      processed_at: event.processed_at,
    }));
  }

  private async getMostFailedEventTypes(): Promise<any[]> {
    const failedTypes = await this.db('webhook_events')
      .select('event_type')
      .count('id as failure_count')
      .where('error_message', 'IS NOT', null)
      .where('created_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .groupBy('event_type')
      .orderBy('failure_count', 'desc')
      .limit(10);

    return failedTypes.map((type) => ({
      event_type: type.event_type,
      failure_count: parseInt(type.failure_count),
    }));
  }

  private generatePerformanceRecommendations(stats: Record<string, unknown>, failedTypes: string[]): string[] {
    const recommendations: string[] = [];

    if (stats.failure_rate > 10) {
      recommendations.push(
        'High failure rate detected. Review error patterns and consider implementing circuit breaker pattern.',
      );
    }

    if (stats.avg_retries > 1) {
      recommendations.push(
        'High retry rate suggests temporary failures. Consider implementing exponential backoff.',
      );
    }

    if (failedTypes.length > 0) {
      recommendations.push(
        `Focus on improving handling for ${failedTypes[0].event_type} events which have the highest failure rate.`,
      );
    }

    if (stats.max_retries >= 3) {
      recommendations.push(
        'Some events reaching maximum retry count. Review webhook endpoint reliability.',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Webhook performance looks healthy. Continue monitoring.');
    }

    return recommendations;
  }
}