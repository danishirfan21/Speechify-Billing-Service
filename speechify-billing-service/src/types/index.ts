export type SubscriptionStatus = 
  | 'active' 
  | 'canceled' 
  | 'past_due' 
  | 'unpaid' 
  | 'trialing' 
  | 'incomplete' 
  | 'incomplete_expired';

export type PlanType = 'free' | 'premium' | 'pro';
export type BillingInterval = 'month' | 'year';
export type PaymentStatus = 'succeeded' | 'pending' | 'failed' | 'canceled';
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
export type Currency = 'usd' | 'eur' | 'gbp' | 'cad' | 'aud' | 'jpy';

export interface Customer {
  id: string;
  stripe_customer_id: string;
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  tax_id?: string;
  currency: Currency;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface SubscriptionPlan {
  id: string;
  stripe_product_id: string;
  stripe_price_id: string;
  name: string;
  description?: string;
  plan_type: PlanType;
  amount: number;
  currency: Currency;
  billing_interval: BillingInterval;
  billing_interval_count: number;
  usage_limit?: number;
  features?: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription {
  id: string;
  stripe_subscription_id: string;
  customer_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: Date;
  current_period_end: Date;
  trial_start?: Date;
  trial_end?: Date;
  cancel_at?: Date;
  canceled_at?: Date;
  cancel_at_period_end: boolean;
  quantity: number;
  discount_percentage: number;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentMethod {
  id: string;
  stripe_payment_method_id: string;
  customer_id: string;
  type: string;
  card_brand?: string;
  card_last_four?: string;
  card_exp_month?: number;
  card_exp_year?: number;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Invoice {
  id: string;
  stripe_invoice_id: string;
  customer_id: string;
  subscription_id?: string;
  invoice_number?: string;
  status: InvoiceStatus;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: Currency;
  due_date?: Date;
  paid_at?: Date;
  hosted_invoice_url?: string;
  invoice_pdf_url?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface UsageRecord {
  id: string;
  customer_id: string;
  subscription_id?: string;
  metric_name: string;
  quantity: number;
  timestamp: Date;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  processed: boolean;
  processed_at?: Date;
  error_message?: string;
  retry_count: number;
  data: Record<string, any>;
  created_at: Date;
}

export interface FailedPayment {
  id: string;
  customer_id: string;
  subscription_id?: string;
  stripe_payment_intent_id?: string;
  amount: number;
  currency: Currency;
  failure_reason?: string;
  failure_code?: string;
  retry_count: number;
  next_retry_at?: Date;
  resolved: boolean;
  resolved_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PromotionalCode {
  id: string;
  stripe_coupon_id: string;
  code: string;
  name?: string;
  percent_off?: number;
  amount_off?: number;
  currency?: Currency;
  duration: 'once' | 'repeating' | 'forever';
  duration_in_months?: number;
  max_redemptions?: number;
  times_redeemed: number;
  is_active: boolean;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// API Request/Response types
export interface CreateCustomerRequest {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  tax_id?: string;
}

export interface CreateSubscriptionRequest {
  customer_id: string;
  plan_id: string;
  payment_method_id?: string;
  trial_days?: number;
  promo_code?: string;
  quantity?: number;
}

export interface UpdateSubscriptionRequest {
  plan_id?: string;
  quantity?: number;
  prorate?: boolean;
  cancel_at_period_end?: boolean;
  promo_code?: string;
}

export interface UsageStats {
  customer_id: string;
  subscription_id?: string;
  current_period_usage: number;
  current_period_limit: number;
  usage_percentage: number;
  overage_amount: number;
  last_updated: Date;
  usage_by_metric: Record<string, number>;
}

// Error types
export interface BillingError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;
}

// Configuration types
export interface BillingConfig {
  stripe: {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
    apiVersion: string;
  };
  plans: {
    free: {
      monthlyLimit: number;
    };
    premium: {
      monthlyLimit: number;
      price: number;
    };
    pro: {
      monthlyLimit: number;
      price: number;
    };
  };
  currency: Currency;
  trialDays: number;
}

// Webhook event data types
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
    previous_attributes?: any;
  };
  created: number;
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string;
    idempotency_key?: string;
  };
}

// Analytics types
export interface SubscriptionAnalytics {
  total_subscriptions: number;
  active_subscriptions: number;
  churned_subscriptions: number;
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  churn_rate: number;
  growth_rate: number;
  ltv: number; // Customer Lifetime Value
  by_plan: Record<PlanType, {
    count: number;
    revenue: number;
  }>;
}

export interface UsageAnalytics {
  total_usage: number;
  average_usage_per_customer: number;
  peak_usage_day: string;
  usage_growth_rate: number;
  by_metric: Record<string, {
    total: number;
    average: number;
    peak: number;
  }>;