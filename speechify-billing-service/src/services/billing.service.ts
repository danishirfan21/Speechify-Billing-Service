import { getDatabase } from '../database/connection';
import { stripeService } from './stripe.service';
import { logger } from '../utils/logger';
import {
  Customer,
  Subscription,
  SubscriptionPlan,
  CreateCustomerRequest,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  UsageRecord,
  UsageStats,
  BillingError,
  PaymentMethod,
  Invoice,
} from '../types';

export class BillingService {
  private db = getDatabase();

  // Customer Management
  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    const trx = await this.db.transaction();

    try {
      // Check if customer already exists
      const existingCustomer = await trx('customers').where('email', data.email).first();

      if (existingCustomer) {
        throw new BillingError('Customer with this email already exists', 'CUSTOMER_EXISTS', 409);
      }

      // Create customer in Stripe
      const stripeCustomer = await stripeService.createCustomer(data);

      // Save customer to database
      const [customer] = await trx('customers')
        .insert({
          stripe_customer_id: stripeCustomer.id,
          email: data.email,
          name: data.name,
          company: data.company,
          phone: data.phone,
          address_line1: data.address?.line1,
          address_line2: data.address?.line2,
          city: data.address?.city,
          state: data.address?.state,
          postal_code: data.address?.postal_code,
          country: data.address?.country,
          tax_id: data.tax_id,
        })
        .returning('*');

      await trx.commit();
      logger.info(`Customer created: ${customer.id}`);
      return customer;
    } catch (error) {
      await trx.rollback();
      logger.error('Failed to create customer:', error);
      throw error;
    }
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      const customer = await this.db('customers')
        .where('id', customerId)
        .whereNull('deleted_at')
        .first();

      return customer || null;
    } catch (error) {
      logger.error('Failed to get customer:', error);
      throw error;
    }
  }

  async getCustomerByStripeId(stripeCustomerId: string): Promise<Customer | null> {
    try {
      const customer = await this.db('customers')
        .where('stripe_customer_id', stripeCustomerId)
        .whereNull('deleted_at')
        .first();

      return customer || null;
    } catch (error) {
      logger.error('Failed to get customer by Stripe ID:', error);
      throw error;
    }
  }

  async updateCustomer(
    customerId: string,
    data: Partial<CreateCustomerRequest>,
  ): Promise<Customer> {
    const trx = await this.db.transaction();

    try {
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        throw new BillingError('Customer not found', 'CUSTOMER_NOT_FOUND', 404);
      }

      // Update in Stripe
      await stripeService.updateCustomer(customer.stripe_customer_id, data);

      // Update in database
      const [updatedCustomer] = await trx('customers')
        .where('id', customerId)
        .update({
          email: data.email,
          name: data.name,
          company: data.company,
          phone: data.phone,
          address_line1: data.address?.line1,
          address_line2: data.address?.line2,
          city: data.address?.city,
          state: data.address?.state,
          postal_code: data.address?.postal_code,
          country: data.address?.country,
          tax_id: data.tax_id,
          updated_at: new Date(),
        })
        .returning('*');

      await trx.commit();
      logger.info(`Customer updated: ${customerId}`);
      return updatedCustomer;
    } catch (error) {
      await trx.rollback();
      logger.error('Failed to update customer:', error);
      throw error;
    }
  }

  async deleteCustomer(customerId: string): Promise<void> {
    try {
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        throw new BillingError('Customer not found', 'CUSTOMER_NOT_FOUND', 404);
      }

      // Soft delete in database
      await this.db('customers').where('id', customerId).update({
        deleted_at: new Date(),
        updated_at: new Date(),
      });

      logger.info(`Customer soft deleted: ${customerId}`);
    } catch (error) {
      logger.error('Failed to delete customer:', error);
      throw error;
    }
  }

  async listCustomers(options: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ customers: Customer[]; total: number; pagination: any }> {
    try {
      const { page, limit, search } = options;
      const offset = (page - 1) * limit;

      let query = this.db('customers').whereNull('deleted_at');

      if (search) {
        query = query.where(function () {
          this.where('email', 'ilike', `%${search}%`)
            .orWhere('name', 'ilike', `%${search}%`)
            .orWhere('company', 'ilike', `%${search}%`);
        });
      }

      const [customers, totalResult] = await Promise.all([
        query.clone().orderBy('created_at', 'desc').limit(limit).offset(offset),
        query.clone().count('id as count').first(),
      ]);

      const total = parseInt(totalResult?.count || '0');
      const totalPages = Math.ceil(total / limit);

      return {
        customers,
        total,
        pagination: {
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to list customers:', error);
      throw error;
    }
  }

  // Subscription Management
  async createSubscription(data: CreateSubscriptionRequest): Promise<Subscription> {
    const trx = await this.db.transaction();

    try {
      // Get customer and plan
      const customer = await this.getCustomer(data.customer_id);
      if (!customer) {
        throw new BillingError('Customer not found', 'CUSTOMER_NOT_FOUND', 404);
      }

      const plan = await this.getSubscriptionPlan(data.plan_id);
      if (!plan) {
        throw new BillingError('Subscription plan not found', 'PLAN_NOT_FOUND', 404);
      }

      // Check if customer already has an active subscription
      const existingSubscription = await trx('subscriptions')
        .where('customer_id', data.customer_id)
        .whereIn('status', ['active', 'trialing', 'past_due'])
        .first();

      if (existingSubscription) {
        throw new BillingError(
          'Customer already has an active subscription',
          'SUBSCRIPTION_EXISTS',
          409,
        );
      }

      // Create subscription in Stripe
      const stripeSubscription = await stripeService.createSubscription({
        customer_id: customer.stripe_customer_id,
        plan_id: plan.stripe_price_id,
        payment_method_id: data.payment_method_id,
        trial_days: data.trial_days,
        promo_code: data.promo_code,
        quantity: data.quantity,
      });

      // Save subscription to database
      const [subscription] = await trx('subscriptions')
        .insert({
          stripe_subscription_id: stripeSubscription.id,
          customer_id: data.customer_id,
          plan_id: data.plan_id,
          status: stripeSubscription.status as any,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000),
          trial_start: stripeSubscription.trial_start
            ? new Date(stripeSubscription.trial_start * 1000)
            : null,
          trial_end: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
          cancel_at: stripeSubscription.cancel_at
            ? new Date(stripeSubscription.cancel_at * 1000)
            : null,
          canceled_at: stripeSubscription.canceled_at
            ? new Date(stripeSubscription.canceled_at * 1000)
            : null,
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          quantity: data.quantity || 1,
          metadata: stripeSubscription.metadata,
        })
        .returning('*');

      await trx.commit();
      logger.info(`Subscription created: ${subscription.id}`);
      return subscription;
    } catch (error) {
      await trx.rollback();
      logger.error('Failed to create subscription:', error);
      throw error;
    }
  }

  async updateSubscription(
    subscriptionId: string,
    data: UpdateSubscriptionRequest,
  ): Promise<Subscription> {
    const trx = await this.db.transaction();

    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
      }

      // Update in Stripe
      const stripeSubscription = await stripeService.updateSubscription(
        subscription.stripe_subscription_id,
        data,
      );

      // Update in database
      const updateData: any = {
        updated_at: new Date(),
      };

      if (data.plan_id) {
        updateData.plan_id = data.plan_id;
      }

      if (data.quantity !== undefined) {
        updateData.quantity = data.quantity;
      }

      if (data.cancel_at_period_end !== undefined) {
        updateData.cancel_at_period_end = data.cancel_at_period_end;
      }

      // Update status and other fields from Stripe response
      updateData.status = stripeSubscription.status;
      updateData.current_period_start = new Date(stripeSubscription.current_period_start * 1000);
      updateData.current_period_end = new Date(stripeSubscription.current_period_end * 1000);
      updateData.cancel_at = stripeSubscription.cancel_at
        ? new Date(stripeSubscription.cancel_at * 1000)
        : null;

      const [updatedSubscription] = await trx('subscriptions')
        .where('id', subscriptionId)
        .update(updateData)
        .returning('*');

      await trx.commit();
      logger.info(`Subscription updated: ${subscriptionId}`);
      return updatedSubscription;
    } catch (error) {
      await trx.rollback();
      logger.error('Failed to update subscription:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string, immediately = false): Promise<Subscription> {
    const trx = await this.db.transaction();

    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
      }

      // Cancel in Stripe
      const stripeSubscription = await stripeService.cancelSubscription(
        subscription.stripe_subscription_id,
        immediately,
      );

      // Update in database
      const [updatedSubscription] = await trx('subscriptions')
        .where('id', subscriptionId)
        .update({
          status: stripeSubscription.status,
          cancel_at: stripeSubscription.cancel_at
            ? new Date(stripeSubscription.cancel_at * 1000)
            : null,
          canceled_at: stripeSubscription.canceled_at
            ? new Date(stripeSubscription.canceled_at * 1000)
            : null,
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          updated_at: new Date(),
        })
        .returning('*');

      await trx.commit();
      logger.info(
        `Subscription ${
          immediately ? 'canceled' : 'scheduled for cancellation'
        }: ${subscriptionId}`,
      );
      return updatedSubscription;
    } catch (error) {
      await trx.rollback();
      logger.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  async pauseSubscription(subscriptionId: string, resumeAt?: Date): Promise<Subscription> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
      }

      // Update subscription to pause at period end
      const [updatedSubscription] = await this.db('subscriptions')
        .where('id', subscriptionId)
        .update({
          cancel_at_period_end: true,
          cancel_at: resumeAt || subscription.current_period_end,
          updated_at: new Date(),
        })
        .returning('*');

      logger.info(`Subscription paused: ${subscriptionId}`);
      return updatedSubscription;
    } catch (error) {
      logger.error('Failed to pause subscription:', error);
      throw error;
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
      }

      // Resume subscription in Stripe
      const stripeSubscription = await stripeService.updateSubscription(
        subscription.stripe_subscription_id,
        { cancel_at_period_end: false },
      );

      // Update in database
      const [updatedSubscription] = await this.db('subscriptions')
        .where('id', subscriptionId)
        .update({
          cancel_at_period_end: false,
          cancel_at: null,
          status: stripeSubscription.status,
          updated_at: new Date(),
        })
        .returning('*');

      logger.info(`Subscription resumed: ${subscriptionId}`);
      return updatedSubscription;
    } catch (error) {
      logger.error('Failed to resume subscription:', error);
      throw error;
    }
  }

  async previewSubscriptionChange(
    subscriptionId: string,
    changes: {
      plan_id?: string;
      quantity?: number;
    },
  ): Promise<any> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
      }

      // Get upcoming invoice from Stripe to preview changes
      const preview = await stripeService.getUpcomingInvoice(
        subscription.stripe_subscription_id,
        changes,
      );

      return {
        current_amount: subscription.current_period_end,
        new_amount: preview.amount_due / 100,
        proration_amount: preview.amount_due / 100 - (subscription.amount || 0),
        next_payment_date: new Date(preview.period_end * 1000),
      };
    } catch (error) {
      logger.error('Failed to preview subscription change:', error);
      throw error;
    }
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      const subscription = await this.db('subscriptions').where('id', subscriptionId).first();

      return subscription || null;
    } catch (error) {
      logger.error('Failed to get subscription:', error);
      throw error;
    }
  }

  async getCustomerSubscriptions(customerId: string): Promise<Subscription[]> {
    try {
      const subscriptions = await this.db('subscriptions')
        .where('customer_id', customerId)
        .orderBy('created_at', 'desc');

      return subscriptions;
    } catch (error) {
      logger.error('Failed to get customer subscriptions:', error);
      throw error;
    }
  }

  // Usage Tracking
  async recordUsage(
    customerId: string,
    metricName: string,
    quantity: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      // Get customer's active subscription
      const subscription = await this.db('subscriptions')
        .where('customer_id', customerId)
        .where('status', 'active')
        .first();

      // Record usage in database
      await this.db('usage_records').insert({
        customer_id: customerId,
        subscription_id: subscription?.id,
        metric_name: metricName,
        quantity,
        metadata,
        timestamp: new Date(),
      });

      logger.info(`Usage recorded: ${quantity} ${metricName} for customer ${customerId}`);
    } catch (error) {
      logger.error('Failed to record usage:', error);
      throw error;
    }
  }

  async getUsageStats(customerId: string, period = 'current'): Promise<UsageStats> {
    try {
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        throw new BillingError('Customer not found', 'CUSTOMER_NOT_FOUND', 404);
      }

      const subscription = await this.db('subscriptions')
        .where('customer_id', customerId)
        .where('status', 'active')
        .first();

      if (!subscription) {
        return {
          customer_id: customerId,
          current_period_usage: 0,
          current_period_limit: 0,
          usage_percentage: 0,
          overage_amount: 0,
          last_updated: new Date(),
          usage_by_metric: {},
        };
      }

      const plan = await this.getSubscriptionPlan(subscription.plan_id);
      if (!plan) {
        throw new BillingError('Subscription plan not found', 'PLAN_NOT_FOUND', 404);
      }

      let startDate: Date;
      let endDate: Date;

      switch (period) {
        case 'previous':
          const prevPeriodStart = new Date(subscription.current_period_start);
          prevPeriodStart.setMonth(prevPeriodStart.getMonth() - 1);
          const prevPeriodEnd = new Date(subscription.current_period_start);
          startDate = prevPeriodStart;
          endDate = prevPeriodEnd;
          break;
        case 'last30days':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          endDate = new Date();
          break;
        case 'current':
        default:
          startDate = subscription.current_period_start;
          endDate = subscription.current_period_end;
      }

      // Get usage for specified period
      const usageRecords = await this.db('usage_records')
        .where('customer_id', customerId)
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<', endDate);

      const totalUsage = usageRecords.reduce((sum, record) => sum + record.quantity, 0);
      const usageByMetric = usageRecords.reduce((acc, record) => {
        acc[record.metric_name] = (acc[record.metric_name] || 0) + record.quantity;
        return acc;
      }, {} as Record<string, number>);

      const usageLimit = plan.usage_limit || 0;
      const usagePercentage = usageLimit > 0 ? (totalUsage / usageLimit) * 100 : 0;
      const overageAmount = Math.max(0, totalUsage - usageLimit);

      return {
        customer_id: customerId,
        subscription_id: subscription.id,
        current_period_usage: totalUsage,
        current_period_limit: usageLimit,
        usage_percentage: Math.min(100, usagePercentage),
        overage_amount: overageAmount,
        last_updated: new Date(),
        usage_by_metric: usageByMetric,
      };
    } catch (error) {
      logger.error('Failed to get usage stats:', error);
      throw error;
    }
  }

  // Subscription Plans
  async createSubscriptionPlan(
    planData: Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<SubscriptionPlan> {
    try {
      const [plan] = await this.db('subscription_plans').insert(planData).returning('*');

      logger.info(`Subscription plan created: ${plan.id}`);
      return plan;
    } catch (error) {
      logger.error('Failed to create subscription plan:', error);
      throw error;
    }
  }

  async getSubscriptionPlan(planId: string): Promise<SubscriptionPlan | null> {
    try {
      const plan = await this.db('subscription_plans')
        .where('id', planId)
        .where('is_active', true)
        .first();

      return plan || null;
    } catch (error) {
      logger.error('Failed to get subscription plan:', error);
      throw error;
    }
  }

  async getAllSubscriptionPlans(currency = 'usd'): Promise<SubscriptionPlan[]> {
    try {
      const plans = await this.db('subscription_plans')
        .where('is_active', true)
        .where('currency', currency)
        .orderBy('amount', 'asc');

      return plans;
    } catch (error) {
      logger.error('Failed to get subscription plans:', error);
      throw error;
    }
  }

  // Payment Methods
  async getCustomerPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      const paymentMethods = await this.db('payment_methods')
        .where('customer_id', customerId)
        .orderBy('created_at', 'desc');

      return paymentMethods;
    } catch (error) {
      logger.error('Failed to get customer payment methods:', error);
      throw error;
    }
  }

  async savePaymentMethod(
    paymentMethodData: Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<PaymentMethod> {
    try {
      const [paymentMethod] = await this.db('payment_methods')
        .insert(paymentMethodData)
        .returning('*');

      logger.info(`Payment method saved: ${paymentMethod.id}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Failed to save payment method:', error);
      throw error;
    }
  }

  // Invoices
  async getCustomerInvoices(customerId: string, limit = 10): Promise<Invoice[]> {
    try {
      const invoices = await this.db('invoices')
        .where('customer_id', customerId)
        .orderBy('created_at', 'desc')
        .limit(limit);

      return invoices;
    } catch (error) {
      logger.error('Failed to get customer invoices:', error);
      throw error;
    }
  }

  async saveInvoice(
    invoiceData: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Invoice> {
    try {
      const [invoice] = await this.db('invoices').insert(invoiceData).returning('*');

      logger.info(`Invoice saved: ${invoice.id}`);
      return invoice;
    } catch (error) {
      logger.error('Failed to save invoice:', error);
      throw error;
    }
  }

  // Admin Functions
  async listCustomersAdmin(options: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }): Promise<any> {
    try {
      const { page, limit, search, status, sortBy, sortOrder } = options;
      const offset = (page - 1) * limit;

      let query = this.db('customers as c')
        .leftJoin('subscriptions as s', 'c.id', 's.customer_id')
        .leftJoin('subscription_plans as sp', 's.plan_id', 'sp.id')
        .select(
          'c.*',
          's.status as subscription_status',
          'sp.name as plan_name',
          'sp.plan_type',
          this.db.raw(
            "SUM(CASE WHEN i.status = 'paid' THEN i.amount_paid ELSE 0 END) as total_revenue",
          ),
        )
        .leftJoin('invoices as i', 'c.id', 'i.customer_id')
        .whereNull('c.deleted_at')
        .groupBy('c.id', 's.status', 'sp.name', 'sp.plan_type');

      if (search) {
        query = query.where(function () {
          this.where('c.email', 'ilike', `%${search}%`)
            .orWhere('c.name', 'ilike', `%${search}%`)
            .orWhere('c.company', 'ilike', `%${search}%`);
        });
      }

      if (status) {
        query = query.where('s.status', status);
      }

      const [customers, totalResult] = await Promise.all([
        query.clone().orderBy(sortBy, sortOrder).limit(limit).offset(offset),
        query.clone().count('c.id as count').first(),
      ]);

      const total = parseInt(totalResult?.count || '0');
      const totalPages = Math.ceil(total / limit);

      return {
        customers,
        total,
        pagination: {
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to list customers for admin:', error);
      throw error;
    }
  }

  async listSubscriptionsAdmin(options: {
    page: number;
    limit: number;
    status?: string;
    planType?: string;
  }): Promise<any> {
    try {
      const { page, limit, status, planType } = options;
      const offset = (page - 1) * limit;

      let query = this.db('subscriptions as s')
        .join('customers as c', 's.customer_id', 'c.id')
        .join('subscription_plans as sp', 's.plan_id', 'sp.id')
        .select(
          's.*',
          'c.name as customer_name',
          'c.email as customer_email',
          'sp.name as plan_name',
          'sp.plan_type',
          'sp.amount as plan_amount',
        );

      if (status) {
        query = query.where('s.status', status);
      }

      if (planType) {
        query = query.where('sp.plan_type', planType);
      }

      const [subscriptions, totalResult] = await Promise.all([
        query.clone().orderBy('s.created_at', 'desc').limit(limit).offset(offset),
        query.clone().count('s.id as count').first(),
      ]);

      const total = parseInt(totalResult?.count || '0');
      const totalPages = Math.ceil(total / limit);

      return {
        subscriptions,
        total,
        pagination: {
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to list subscriptions for admin:', error);
      throw error;
    }
  }

  async suspendCustomer(customerId: string, reason: string): Promise<void> {
    try {
      await this.db('customers').where('id', customerId).update({
        is_suspended: true,
        suspension_reason: reason,
        suspended_at: new Date(),
        updated_at: new Date(),
      });

      // Cancel active subscriptions
      await this.db('subscriptions')
        .where('customer_id', customerId)
        .whereIn('status', ['active', 'trialing'])
        .update({
          status: 'canceled',
          canceled_at: new Date(),
          updated_at: new Date(),
        });

      logger.warn(`Customer suspended: ${customerId}, reason: ${reason}`);
    } catch (error) {
      logger.error('Failed to suspend customer:', error);
      throw error;
    }
  }

  async reactivateCustomer(customerId: string): Promise<void> {
    try {
      await this.db('customers').where('id', customerId).update({
        is_suspended: false,
        suspension_reason: null,
        suspended_at: null,
        updated_at: new Date(),
      });

      logger.info(`Customer reactivated: ${customerId}`);
    } catch (error) {
      logger.error('Failed to reactivate customer:', error);
      throw error;
    }
  }

  async getFailedPayments(options?: { page?: number; limit?: number }): Promise<any> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      const query = this.db('failed_payments as fp')
        .join('customers as c', 'fp.customer_id', 'c.id')
        .leftJoin('subscriptions as s', 'fp.subscription_id', 's.id')
        .select(
          'fp.*',
          'c.name as customer_name',
          'c.email as customer_email',
          's.id as subscription_id',
        )
        .where('fp.resolved', false);

      const [failedPayments, totalResult] = await Promise.all([
        query.clone().orderBy('fp.created_at', 'desc').limit(limit).offset(offset),
        query.clone().count('fp.id as count').first(),
      ]);

      const total = parseInt(totalResult?.count || '0');
      const totalPages = Math.ceil(total / limit);

      return {
        failedPayments,
        total,
        pagination: {
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to get failed payments:', error);
      throw error;
    }
  }

  async retryFailedPayment(failedPaymentId: string): Promise<void> {
    try {
      const failedPayment = await this.db('failed_payments').where('id', failedPaymentId).first();

      if (!failedPayment) {
        throw new BillingError('Failed payment not found', 'FAILED_PAYMENT_NOT_FOUND', 404);
      }

      // Update retry count and next retry time
      await this.db('failed_payments')
        .where('id', failedPaymentId)
        .update({
          retry_count: failedPayment.retry_count + 1,
          next_retry_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // Retry in 24 hours
          updated_at: new Date(),
        });

      logger.info(`Failed payment retry scheduled: ${failedPaymentId}`);
    } catch (error) {
      logger.error('Failed to retry failed payment:', error);
      throw error;
    }
  }

  async createPromotionalCode(data: any): Promise<any> {
    try {
      // Create coupon in Stripe first
      const stripeCoupon = await stripeService.createCoupon(
        data.code,
        data.percent_off,
        data.amount_off,
        data.currency,
        data.duration,
        data.duration_in_months,
      );

      // Save to database
      const [promoCode] = await this.db('promotional_codes')
        .insert({
          stripe_coupon_id: stripeCoupon.id,
          code: data.code,
          name: data.name,
          percent_off: data.percent_off,
          amount_off: data.amount_off,
          currency: data.currency,
          duration: data.duration,
          duration_in_months: data.duration_in_months,
          max_redemptions: data.max_redemptions,
          expires_at: data.expires_at,
        })
        .returning('*');

      logger.info(`Promotional code created: ${promoCode.id}`);
      return promoCode;
    } catch (error) {
      logger.error('Failed to create promotional code:', error);
      throw error;
    }
  }

  async listPromotionalCodes(options: {
    page: number;
    limit: number;
    activeOnly: boolean;
  }): Promise<any> {
    try {
      const { page, limit, activeOnly } = options;
      const offset = (page - 1) * limit;

      let query = this.db('promotional_codes');

      if (activeOnly) {
        query = query.where('is_active', true).where(function () {
          this.whereNull('expires_at').orWhere('expires_at', '>', new Date());
        });
      }

      const [promoCodes, totalResult] = await Promise.all([
        query.clone().orderBy('created_at', 'desc').limit(limit).offset(offset),
        query.clone().count('id as count').first(),
      ]);

      const total = parseInt(totalResult?.count || '0');
      const totalPages = Math.ceil(total / limit);

      return {
        promoCodes,
        total,
        pagination: {
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to list promotional codes:', error);
      throw error;
    }
  }

  async exportCustomers(options: {
    format: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any> {
    try {
      let query = this.db('customers as c')
        .leftJoin('subscriptions as s', 'c.id', 's.customer_id')
        .leftJoin('subscription_plans as sp', 's.plan_id', 'sp.id')
        .select(
          'c.email',
          'c.name',
          'c.company',
          'c.created_at',
          's.status as subscription_status',
          'sp.name as plan_name',
          'sp.amount as plan_amount',
        )
        .whereNull('c.deleted_at');

      if (options.startDate) {
        query = query.where('c.created_at', '>=', options.startDate);
      }

      if (options.endDate) {
        query = query.where('c.created_at', '<=', options.endDate);
      }

      const customers = await query;

      return {
        data: customers,
        format: options.format,
        filename: `customers_export_${new Date().toISOString().split('T')[0]}.${options.format}`,
      };
    } catch (error) {
      logger.error('Failed to export customers:', error);
      throw error;
    }
  }

  // Analytics and Reporting
  async getSubscriptionAnalytics(startDate?: Date, endDate?: Date) {
    try {
      const baseQuery = this.db('subscriptions as s')
        .leftJoin('subscription_plans as sp', 's.plan_id', 'sp.id')
        .leftJoin('customers as c', 's.customer_id', 'c.id');

      if (startDate && endDate) {
        baseQuery.whereBetween('s.created_at', [startDate, endDate]);
      }

      const totalSubscriptions = await baseQuery.clone().count('s.id as count').first();

      const activeSubscriptions = await baseQuery
        .clone()
        .whereIn('s.status', ['active', 'trialing'])
        .count('s.id as count')
        .first();

      const churned = await baseQuery
        .clone()
        .whereIn('s.status', ['canceled', 'unpaid'])
        .count('s.id as count')
        .first();

      const revenueData = await baseQuery
        .clone()
        .whereIn('s.status', ['active', 'trialing'])
        .select('sp.plan_type', 'sp.amount', 'sp.billing_interval')
        .sum('sp.amount as total_amount')
        .groupBy('sp.plan_type', 'sp.amount', 'sp.billing_interval');

      // Calculate MRR (Monthly Recurring Revenue)
      let mrr = 0;
      revenueData.forEach((item) => {
        const monthlyAmount =
          item.billing_interval === 'year' ? item.total_amount / 12 : item.total_amount;
        mrr += monthlyAmount;
      });

      const arr = mrr * 12; // Annual Recurring Revenue

      return {
        total_subscriptions: parseInt(totalSubscriptions?.count || '0'),
        active_subscriptions: parseInt(activeSubscriptions?.count || '0'),
        churned_subscriptions: parseInt(churned?.count || '0'),
        mrr,
        arr,
        churn_rate: totalSubscriptions?.count
          ? (parseInt(churned?.count || '0') / parseInt(totalSubscriptions.count)) * 100
          : 0,
        revenue_by_plan: revenueData,
      };
    } catch (error) {
      logger.error('Failed to get subscription analytics:', error);
      throw error;
    }
  }

  async getUsageAnalytics(startDate?: Date, endDate?: Date) {
    try {
      let query = this.db('usage_records');

      if (startDate && endDate) {
        query = query.whereBetween('timestamp', [startDate, endDate]);
      }

      const totalUsage = await query.clone().sum('quantity as total').first();
      const avgUsagePerCustomer = await query.clone().avg('quantity as avg').first();

      const usageByMetric = await query
        .clone()
        .select('metric_name')
        .sum('quantity as total')
        .avg('quantity as avg')
        .max('quantity as peak')
        .groupBy('metric_name');

      const peakUsageDay = await query
        .clone()
        .select(this.db.raw('DATE(timestamp) as date'))
        .sum('quantity as total')
        .groupBy(this.db.raw('DATE(timestamp)'))
        .orderBy('total', 'desc')
        .first();

      return {
        total_usage: parseInt(totalUsage?.total || '0'),
        average_usage_per_customer: parseFloat(avgUsagePerCustomer?.avg || '0'),
        peak_usage_day: peakUsageDay?.date || null,
        usage_by_metric: usageByMetric.reduce((acc, item) => {
          acc[item.metric_name] = {
            total: parseInt(item.total),
            average: parseFloat(item.avg),
            peak: parseInt(item.peak),
          };
          return acc;
        }, {} as Record<string, any>),
      };
    } catch (error) {
      logger.error('Failed to get usage analytics:', error);
      throw error;
    }
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; timestamp: Date; components: any }> {
    try {
      // Test database connection
      await this.db.raw('SELECT 1');

      // Test Stripe connection
      const stripeHealthy = await stripeService.testConnection();

      const components = {
        database: { status: 'healthy' },
        stripe: { status: stripeHealthy ? 'healthy' : 'unhealthy' },
        redis: { status: 'healthy' }, // Would test Redis connection
      };

      const overallStatus = Object.values(components).every((c) => c.status === 'healthy')
        ? 'healthy'
        : 'unhealthy';

      return {
        status: overallStatus,
        timestamp: new Date(),
        components,
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        components: {
          database: { status: 'unhealthy', error: error.message },
          stripe: { status: 'unknown' },
          redis: { status: 'unknown' },
        },
      };
    }
  }

  async getSystemHealth(): Promise<any> {
    try {
      const health = await this.healthCheck();

      // Additional system metrics
      const [customerCount, subscriptionCount, failedPaymentCount] = await Promise.all([
        this.db('customers').whereNull('deleted_at').count('id as count').first(),
        this.db('subscriptions')
          .whereIn('status', ['active', 'trialing'])
          .count('id as count')
          .first(),
        this.db('failed_payments').where('resolved', false).count('id as count').first(),
      ]);

      return {
        ...health,
        metrics: {
          total_customers: parseInt(customerCount?.count || '0'),
          active_subscriptions: parseInt(subscriptionCount?.count || '0'),
          failed_payments: parseInt(failedPaymentCount?.count || '0'),
        },
      };
    } catch (error) {
      logger.error('Failed to get system health:', error);
      throw error;
    }
  }
}

// Custom error class
class BillingError extends Error implements BillingError {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: any,
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

export const billingService = new BillingService();
