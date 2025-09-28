import Stripe from 'stripe';
import { getDatabase } from '../database/connection';
import { stripeService } from './stripe.service';
import { billingService } from './billing.service';
import { emailService } from './email.service';
import { logger } from '../utils/logger';
import { WebhookEvent, StripeWebhookEvent } from '../types';

export class WebhookService {
  private db = getDatabase();

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
    const previousAttributes = event.data.previous_attributes as any;

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
          status: invoice.status as any,
          amount_due: invoice.amount_due / 100,
          amount_paid: invoice.amount_paid / 100,
          amount_remaining: invoice.amount_remaining / 100,
          currency: invoice.currency as any,
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
}

export const webhookService = new WebhookService();
