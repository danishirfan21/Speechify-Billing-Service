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
  Invoice
} from '../types';

export class BillingService {
  private db = getDatabase();

  // Customer Management
  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    const trx = await this.db.transaction();
    
    try {
      // Check if customer already exists
      const existingCustomer = await trx('customers')
        .where('email', data.email)
        .first();

      if (existingCustomer) {
        throw new Error('Customer with this email already exists');
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
      logger.error('Failed to get subscription plan:', error);
      throw error;
    }
  }

  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      const plans = await this.db('subscription_plans')
        .where('is_active', true)
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

  async savePaymentMethod(paymentMethodData: Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentMethod> {
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

  async saveInvoice(invoiceData: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>): Promise<Invoice> {
    try {
      const [invoice] = await this.db('invoices')
        .insert(invoiceData)
        .returning('*');

      logger.info(`Invoice saved: ${invoice.id}`);
      return invoice;
    } catch (error) {
      logger.error('Failed to save invoice:', error);
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
      
      const activeSubscriptions = await baseQuery.clone()
        .whereIn('s.status', ['active', 'trialing'])
        .count('s.id as count')
        .first();

      const churned = await baseQuery.clone()
        .whereIn('s.status', ['canceled', 'unpaid'])
        .count('s.id as count')
        .first();

      const revenueData = await baseQuery.clone()
        .whereIn('s.status', ['active', 'trialing'])
        .select('sp.plan_type', 'sp.amount', 'sp.billing_interval')
        .sum('sp.amount as total_amount')
        .groupBy('sp.plan_type', 'sp.amount', 'sp.billing_interval');

      // Calculate MRR (Monthly Recurring Revenue)
      let mrr = 0;
      revenueData.forEach(item => {
        const monthlyAmount = item.billing_interval === 'year' ? item.total_amount / 12 : item.total_amount;
        mrr += monthlyAmount;
      });

      const arr = mrr * 12; // Annual Recurring Revenue

      return {
        total_subscriptions: parseInt(totalSubscriptions?.count || '0'),
        active_subscriptions: parseInt(activeSubscriptions?.count || '0'),
        churned_subscriptions: parseInt(churned?.count || '0'),
        mrr,
        arr,
        churn_rate: totalSubscriptions?.count ? 
          (parseInt(churned?.count || '0') / parseInt(totalSubscriptions.count)) * 100 : 0,
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
      const avgUsagePerCustomer = await query.clone()
        .avg('quantity as avg')
        .first();

      const usageByMetric = await query.clone()
        .select('metric_name')
        .sum('quantity as total')
        .avg('quantity as avg')
        .max('quantity as peak')
        .groupBy('metric_name');

      const peakUsageDay = await query.clone()
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
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      // Test database connection
      await this.db.raw('SELECT 1');
      
      // Test Stripe connection
      const stripeHealthy = await stripeService.testConnection();
      
      if (!stripeHealthy) {
        throw new Error('Stripe connection failed');
      }

      return {
        status: 'healthy',
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
      };
    }
  }
}

export const billingService = new BillingService();) {
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

  async updateCustomer(customerId: string, data: Partial<CreateCustomerRequest>): Promise<Customer> {
    const trx = await this.db.transaction();

    try {
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        throw new Error('Customer not found');
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

  // Subscription Management
  async createSubscription(data: CreateSubscriptionRequest): Promise<Subscription> {
    const trx = await this.db.transaction();

    try {
      // Get customer and plan
      const customer = await this.getCustomer(data.customer_id);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const plan = await this.getSubscriptionPlan(data.plan_id);
      if (!plan) {
        throw new Error('Subscription plan not found');
      }

      // Check if customer already has an active subscription
      const existingSubscription = await trx('subscriptions')
        .where('customer_id', data.customer_id)
        .whereIn('status', ['active', 'trialing', 'past_due'])
        .first();

      if (existingSubscription) {
        throw new Error('Customer already has an active subscription');
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
          trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
          trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
          cancel_at: stripeSubscription.cancel_at ? new Date(stripeSubscription.cancel_at * 1000) : null,
          canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
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

  async updateSubscription(subscriptionId: string, data: UpdateSubscriptionRequest): Promise<Subscription> {
    const trx = await this.db.transaction();

    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Update in Stripe
      const stripeSubscription = await stripeService.updateSubscription(
        subscription.stripe_subscription_id,
        data
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
      updateData.cancel_at = stripeSubscription.cancel_at ? new Date(stripeSubscription.cancel_at * 1000) : null;

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
        throw new Error('Subscription not found');
      }

      // Cancel in Stripe
      const stripeSubscription = await stripeService.cancelSubscription(
        subscription.stripe_subscription_id,
        immediately
      );

      // Update in database
      const [updatedSubscription] = await trx('subscriptions')
        .where('id', subscriptionId)
        .update({
          status: stripeSubscription.status,
          cancel_at: stripeSubscription.cancel_at ? new Date(stripeSubscription.cancel_at * 1000) : null,
          canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          updated_at: new Date(),
        })
        .returning('*');

      await trx.commit();
      logger.info(`Subscription ${immediately ? 'canceled' : 'scheduled for cancellation'}: ${subscriptionId}`);
      return updatedSubscription;
    } catch (error) {
      await trx.rollback();
      logger.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      const subscription = await this.db('subscriptions')
        .where('id', subscriptionId)
        .first();

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
    metadata?: Record<string, any>
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

      // If subscription exists and uses metered billing, report to Stripe
      if (subscription) {
        // This would need subscription item ID for metered billing
        // Implementation depends on your specific metered billing setup
      }

      logger.info(`Usage recorded: ${quantity} ${metricName} for customer ${customerId}`);
    } catch (error) {
      logger.error('Failed to record usage:', error);
      throw error;
    }
  }

  async getUsageStats(customerId: string): Promise<UsageStats> {
    try {
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        throw new Error('Customer not found');
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
        throw new Error('Subscription plan not found');
      }

      // Get usage for current billing period
      const usageRecords = await this.db('usage_records')
        .where('customer_id', customerId)
        .where('timestamp', '>=', subscription.current_period_start)
        .where('timestamp', '<', subscription.current_period_end);

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
        usage_percentage: usagePercentage,
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
  async createSubscriptionPlan(planData: Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'>): Promise<SubscriptionPlan> {
    try {
      const [plan] = await this.db('subscription_plans')
        .insert(planData)
        .returning('*');

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
    } catch (error