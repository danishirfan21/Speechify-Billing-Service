import Stripe from 'stripe';
import { logger } from '../utils/logger';
import {
  CreateCustomerRequest,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  BillingError,
  Currency,
  PlanType,
} from '../types';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      typescript: true,
    });
  }

  // Customer Management
  async createCustomer(data: CreateCustomerRequest): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email: data.email,
        name: data.name,
        phone: data.phone,
        address: data.address
          ? {
              line1: data.address.line1,
              line2: data.address.line2,
              city: data.address.city,
              state: data.address.state,
              postal_code: data.address.postal_code,
              country: data.address.country,
            }
          : undefined,
        tax_id_data: data.tax_id
          ? [
              {
                type: 'us_ein', // This should be dynamic based on country
                value: data.tax_id,
              },
            ]
          : undefined,
        metadata: {
          company: data.company || '',
        },
      });

      logger.info(`Customer created: ${customer.id}`);
      return customer;
    } catch (error) {
      logger.error('Failed to create customer:', error);
      throw this.handleStripeError(error);
    }
  }

  async updateCustomer(
    customerId: string,
    data: Partial<CreateCustomerRequest>,
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        email: data.email,
        name: data.name,
        phone: data.phone,
        address: data.address
          ? {
              line1: data.address.line1,
              line2: data.address.line2,
              city: data.address.city,
              state: data.address.state,
              postal_code: data.address.postal_code,
              country: data.address.country,
            }
          : undefined,
        metadata: {
          company: data.company || '',
        },
      });

      logger.info(`Customer updated: ${customer.id}`);
      return customer;
    } catch (error) {
      logger.error('Failed to update customer:', error);
      throw this.handleStripeError(error);
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      return customer as Stripe.Customer;
    } catch (error) {
      logger.error('Failed to retrieve customer:', error);
      throw this.handleStripeError(error);
    }
  }

  async deleteCustomer(customerId: string): Promise<void> {
    try {
      await this.stripe.customers.del(customerId);
      logger.info(`Customer deleted: ${customerId}`);
    } catch (error) {
      logger.error('Failed to delete customer:', error);
      throw this.handleStripeError(error);
    }
  }

  // Product and Price Management
  async createProduct(name: string, description?: string): Promise<Stripe.Product> {
    try {
      const product = await this.stripe.products.create({
        name,
        description,
        type: 'service',
      });

      logger.info(`Product created: ${product.id}`);
      return product;
    } catch (error) {
      logger.error('Failed to create product:', error);
      throw this.handleStripeError(error);
    }
  }

  async createPrice(
    productId: string,
    amount: number,
    currency: Currency = 'usd',
    interval: 'month' | 'year' = 'month',
  ): Promise<Stripe.Price> {
    try {
      const price = await this.stripe.prices.create({
        product: productId,
        unit_amount: Math.round(amount * 100), // Convert to cents
        currency,
        recurring: {
          interval,
          interval_count: 1,
        },
      });

      logger.info(`Price created: ${price.id}`);
      return price;
    } catch (error) {
      logger.error('Failed to create price:', error);
      throw this.handleStripeError(error);
    }
  }

  // Subscription Management
  async createSubscription(data: CreateSubscriptionRequest): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: data.customer_id,
        items: [
          {
            price: data.plan_id, // This should be the stripe_price_id
            quantity: data.quantity || 1,
          },
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
      };

      if (data.payment_method_id) {
        subscriptionData.default_payment_method = data.payment_method_id;
      }

      if (data.trial_days && data.trial_days > 0) {
        subscriptionData.trial_period_days = data.trial_days;
      }

      if (data.promo_code) {
        subscriptionData.coupon = data.promo_code;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      logger.info(`Subscription created: ${subscription.id}`);
      return subscription;
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw this.handleStripeError(error);
    }
  }

  async updateSubscription(
    subscriptionId: string,
    data: UpdateSubscriptionRequest,
  ): Promise<Stripe.Subscription> {
    try {
      const updateData: Stripe.SubscriptionUpdateParams = {};

      if (data.plan_id) {
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
        updateData.items = [
          {
            id: subscription.items.data[0]?.id,
            price: data.plan_id,
            quantity: data.quantity || 1,
          },
        ];
      }

      if (data.quantity !== undefined) {
        updateData.quantity = data.quantity;
      }

      if (data.cancel_at_period_end !== undefined) {
        updateData.cancel_at_period_end = data.cancel_at_period_end;
      }

      if (data.promo_code) {
        updateData.coupon = data.promo_code;
      }

      if (data.prorate !== undefined) {
        updateData.proration_behavior = data.prorate ? 'create_prorations' : 'none';
      }

      const subscription = await this.stripe.subscriptions.update(subscriptionId, updateData);

      logger.info(`Subscription updated: ${subscription.id}`);
      return subscription;
    } catch (error) {
      logger.error('Failed to update subscription:', error);
      throw this.handleStripeError(error);
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    immediately = false,
  ): Promise<Stripe.Subscription> {
    try {
      let subscription: Stripe.Subscription;

      if (immediately) {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      } else {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }

      logger.info(
        `Subscription ${immediately ? 'canceled' : 'scheduled for cancellation'}: ${
          subscription.id
        }`,
      );
      return subscription;
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      throw this.handleStripeError(error);
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['customer', 'items.data.price.product'],
      });
      return subscription;
    } catch (error) {
      logger.error('Failed to retrieve subscription:', error);
      throw this.handleStripeError(error);
    }
  }

  // Payment Method Management
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      logger.info(`Payment method attached: ${paymentMethod.id}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Failed to attach payment method:', error);
      throw this.handleStripeError(error);
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);
      logger.info(`Payment method detached: ${paymentMethod.id}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Failed to detach payment method:', error);
      throw this.handleStripeError(error);
    }
  }

  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });
      return paymentMethods.data;
    } catch (error) {
      logger.error('Failed to list payment methods:', error);
      throw this.handleStripeError(error);
    }
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      logger.info(`Default payment method set for customer: ${customerId}`);
      return customer;
    } catch (error) {
      logger.error('Failed to set default payment method:', error);
      throw this.handleStripeError(error);
    }
  }

  // Invoice Management
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId);
      return invoice;
    } catch (error) {
      logger.error('Failed to retrieve invoice:', error);
      throw this.handleStripeError(error);
    }
  }

  async listInvoices(customerId?: string, limit = 10): Promise<Stripe.Invoice[]> {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit,
        expand: ['data.subscription'],
      });
      return invoices.data;
    } catch (error) {
      logger.error('Failed to list invoices:', error);
      throw this.handleStripeError(error);
    }
  }

  async payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.pay(invoiceId);
      logger.info(`Invoice paid: ${invoice.id}`);
      return invoice;
    } catch (error) {
      logger.error('Failed to pay invoice:', error);
      throw this.handleStripeError(error);
    }
  }

  // Usage-based billing
  async createUsageRecord(
    subscriptionItemId: string,
    quantity: number,
    timestamp?: number,
  ): Promise<Stripe.UsageRecord> {
    try {
      const usageRecord = await this.stripe.subscriptionItems.createUsageRecord(
        subscriptionItemId,
        {
          quantity,
          timestamp: timestamp || Math.floor(Date.now() / 1000),
          action: 'increment',
        },
      );

      logger.info(`Usage record created: ${quantity} units for ${subscriptionItemId}`);
      return usageRecord;
    } catch (error) {
      logger.error('Failed to create usage record:', error);
      throw this.handleStripeError(error);
    }
  }

  // Coupon and Promotion Management
  async createCoupon(
    id: string,
    percentOff?: number,
    amountOff?: number,
    currency?: Currency,
    duration: 'once' | 'repeating' | 'forever' = 'once',
    durationInMonths?: number,
  ): Promise<Stripe.Coupon> {
    try {
      const couponData: Stripe.CouponCreateParams = {
        id,
        duration,
      };

      if (percentOff) {
        couponData.percent_off = percentOff;
      } else if (amountOff && currency) {
        couponData.amount_off = Math.round(amountOff * 100);
        couponData.currency = currency;
      }

      if (duration === 'repeating' && durationInMonths) {
        couponData.duration_in_months = durationInMonths;
      }

      const coupon = await this.stripe.coupons.create(couponData);
      logger.info(`Coupon created: ${coupon.id}`);
      return coupon;
    } catch (error) {
      logger.error('Failed to create coupon:', error);
      throw this.handleStripeError(error);
    }
  }

  // Webhook verification
  constructEvent(payload: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      logger.error('Failed to construct webhook event:', error);
      throw this.handleStripeError(error);
    }
  }

  // Error handling
  private handleStripeError(error: any): BillingError {
    const billingError: BillingError = {
      name: 'BillingError',
      message: error.message || 'Unknown Stripe error',
      code: error.code || 'STRIPE_ERROR',
      statusCode: error.statusCode || 500,
    };

    if (error.type) {
      billingError.details = {
        type: error.type,
        decline_code: error.decline_code,
        param: error.param,
      };
    }

    return billingError;
  }

  // Utility methods
  async getAccountBalance(): Promise<Stripe.Balance> {
    try {
      return await this.stripe.balance.retrieve();
    } catch (error) {
      logger.error('Failed to retrieve account balance:', error);
      throw this.handleStripeError(error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.stripe.balance.retrieve();
      return true;
    } catch (error) {
      logger.error('Stripe connection test failed:', error);
      return false;
    }
  }

  // Payment Intent Methods
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    customer: string;
    payment_method?: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: params.amount,
        currency: params.currency,
        customer: params.customer,
        payment_method: params.payment_method,
        description: params.description,
        metadata: params.metadata,
        automatic_payment_methods: params.payment_method ? undefined : { enabled: true },
      });

      logger.info(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Failed to create payment intent:', error);
      throw this.handleStripeError(error);
    }
  }

  async confirmPaymentIntent(
    paymentIntentId: string,
    options?: {
      payment_method?: string;
      return_url?: string;
    },
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, options);
      logger.info(`Payment intent confirmed: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Failed to confirm payment intent:', error);
      throw this.handleStripeError(error);
    }
  }

  async retryPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'requires_payment_method') {
        // Re-attempt the payment
        return await this.stripe.paymentIntents.confirm(paymentIntentId);
      }

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to retry payment intent:', error);
      throw this.handleStripeError(error);
    }
  }

  async listPaymentIntents(params: {
    customer?: string;
    limit?: number;
    starting_after?: string;
  }): Promise<Stripe.ApiList<Stripe.PaymentIntent>> {
    try {
      return await this.stripe.paymentIntents.list(params);
    } catch (error) {
      logger.error('Failed to list payment intents:', error);
      throw this.handleStripeError(error);
    }
  }

  // Setup Intent Methods
  async createSetupIntent(
    customerId: string,
    usage: 'on_session' | 'off_session' = 'off_session',
  ): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        usage,
        payment_method_types: ['card'],
      });

      logger.info(`Setup intent created: ${setupIntent.id}`);
      return setupIntent;
    } catch (error) {
      logger.error('Failed to create setup intent:', error);
      throw this.handleStripeError(error);
    }
  }

  // Refund Methods
  async createRefund(params: {
    payment_intent: string;
    amount?: number;
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'expired_uncaptured_charge';
    metadata?: Record<string, any>;
  }): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.create(params);
      logger.info(`Refund created: ${refund.id}`);
      return refund;
    } catch (error) {
      logger.error('Failed to create refund:', error);
      throw this.handleStripeError(error);
    }
  }

  // Tax Rate Methods
  async getTaxRates(params?: { country?: string; state?: string }): Promise<Stripe.TaxRate[]> {
    try {
      const taxRates = await this.stripe.taxRates.list({
        active: true,
        limit: 100,
      });
      return taxRates.data;
    } catch (error) {
      logger.error('Failed to get tax rates:', error);
      throw this.handleStripeError(error);
    }
  }

  // Invoice Preview Methods
  async getUpcomingInvoice(customerId: string, subscriptionId?: string): Promise<Stripe.Invoice> {
    try {
      const params: Stripe.InvoiceRetrieveUpcomingParams = {
        customer: customerId,
      };

      if (subscriptionId) {
        params.subscription = subscriptionId;
      }

      return await this.stripe.invoices.retrieveUpcoming(params);
    } catch (error) {
      logger.error('Failed to get upcoming invoice:', error);
      throw this.handleStripeError(error);
    }
  }

  async previewSubscription(params: {
    customer: string;
    items: Array<{ price: string; quantity?: number }>;
    coupon?: string;
    trial_period_days?: number;
  }): Promise<Stripe.Invoice> {
    try {
      return await this.stripe.invoices.retrieveUpcoming({
        customer: params.customer,
        subscription_items: params.items,
        coupon: params.coupon,
        subscription_trial_end: params.trial_period_days
          ? Math.floor(Date.now() / 1000) + params.trial_period_days * 24 * 60 * 60
          : undefined,
      });
    } catch (error) {
      logger.error('Failed to preview subscription:', error);
      throw this.handleStripeError(error);
    }
  }

  // Customer Balance Methods
  async getCustomerBalance(customerId: string): Promise<number> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        throw new Error('Customer has been deleted');
      }
      return customer.balance;
    } catch (error) {
      logger.error('Failed to get customer balance:', error);
      throw this.handleStripeError(error);
    }
  }

  // Promotional Code Methods
  async getPromotionalCode(promoCode: string): Promise<Stripe.PromotionCode | null> {
    try {
      const promoCodes = await this.stripe.promotionCodes.list({
        code: promoCode,
        active: true,
        limit: 1,
      });

      return promoCodes.data[0] || null;
    } catch (error) {
      logger.error('Failed to get promotional code:', error);
      throw this.handleStripeError(error);
    }
  }

  async createPromotionCode(params: {
    coupon: string;
    code: string;
    max_redemptions?: number;
    expires_at?: number;
  }): Promise<Stripe.PromotionCode> {
    try {
      const promoCode = await this.stripe.promotionCodes.create(params);
      logger.info(`Promotion code created: ${promoCode.id}`);
      return promoCode;
    } catch (error) {
      logger.error('Failed to create promotion code:', error);
      throw this.handleStripeError(error);
    }
  }
}

export const stripeService = new StripeService();
