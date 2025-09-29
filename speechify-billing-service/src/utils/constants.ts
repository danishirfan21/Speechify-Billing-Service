// API Constants
export const API_VERSION = 'v1';
export const API_BASE_PATH = `/api/${API_VERSION}`;

// Subscription Plans
export const SUBSCRIPTION_PLANS = {
  FREE: {
    name: 'Free',
    type: 'free',
    monthlyLimit: 10000,
    price: 0,
  },
  PREMIUM: {
    name: 'Premium',
    type: 'premium',
    monthlyLimit: 100000,
    price: 9.99,
  },
  PRO: {
    name: 'Pro',
    type: 'pro',
    monthlyLimit: 1000000,
    price: 19.99,
  },
} as const;

// Supported Currencies
export const CURRENCIES = ['usd', 'eur', 'gbp', 'cad', 'aud', 'jpy'] as const;

// Billing Intervals
export const BILLING_INTERVALS = ['month', 'year'] as const;

// Subscription Statuses
export const SUBSCRIPTION_STATUSES = [
  'active',
  'canceled',
  'past_due',
  'unpaid',
  'trialing',
  'incomplete',
  'incomplete_expired',
] as const;

// Invoice Statuses
export const INVOICE_STATUSES = ['draft', 'open', 'paid', 'uncollectible', 'void'] as const;

// Payment Statuses
export const PAYMENT_STATUSES = ['succeeded', 'pending', 'failed', 'canceled'] as const;

// Usage Metrics
export const USAGE_METRICS = {
  API_CALLS: 'api_calls',
  CHARACTERS_PROCESSED: 'characters_processed',
  VOICE_MINUTES: 'voice_minutes',
  STORAGE_MB: 'storage_mb',
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  DEFAULT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  WEBHOOK: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 1000,
  },
  ADMIN: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 50,
  },
} as const;

// Cache TTL (in seconds)
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 1800, // 30 minutes
  DASHBOARD: 3600, // 1 hour
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// Webhook Events
export const WEBHOOK_EVENTS = {
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',
  SUBSCRIPTION_CREATED: 'customer.subscription.created',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  SUBSCRIPTION_TRIAL_WILL_END: 'customer.subscription.trial_will_end',
  INVOICE_CREATED: 'invoice.created',
  INVOICE_PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  INVOICE_UPCOMING: 'invoice.upcoming',
  PAYMENT_METHOD_ATTACHED: 'payment_method.attached',
  PAYMENT_METHOD_DETACHED: 'payment_method.detached',
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',
  CHARGE_DISPUTE_CREATED: 'charge.dispute.created',
} as const;

// Error Codes
export const ERROR_CODES = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  API_KEY_EXPIRED: 'API_KEY_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',

  // Business Logic
  CUSTOMER_EXISTS: 'CUSTOMER_EXISTS',
  SUBSCRIPTION_EXISTS: 'SUBSCRIPTION_EXISTS',
  USAGE_LIMIT_EXCEEDED: 'USAGE_LIMIT_EXCEEDED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  INVALID_PLAN: 'INVALID_PLAN',

  // System
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  STRIPE_ERROR: 'STRIPE_ERROR',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Security
  IP_NOT_ALLOWED: 'IP_NOT_ALLOWED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
} as const;

// Email Templates
export const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  TRIAL_ENDING: 'trial_ending',
  SUBSCRIPTION_CANCELED: 'subscription_canceled',
  TRIAL_CONVERTED: 'trial_converted',
  UPCOMING_INVOICE: 'upcoming_invoice',
  DUNNING: 'dunning',
} as const;

// Time Periods
export const TIME_PERIODS = {
  HOUR: 'hour',
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
} as const;

// Analytics Granularity
export const ANALYTICS_GRANULARITY = {
  HOURLY: 'hour',
  DAILY: 'day',
  WEEKLY: 'week',
  MONTHLY: 'month',
  YEARLY: 'year',
} as const;

// Retry Configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
} as const;

// File Upload Limits
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
} as const;

// Dunning Configuration
export const DUNNING_CONFIG = {
  RETRY_DAYS: [1, 3, 7, 14],
  MAX_DAYS: 14,
  CANCEL_AFTER_DAYS: 14,
} as const;

// Trial Configuration
export const TRIAL_CONFIG = {
  DEFAULT_DAYS: 14,
  MAX_DAYS: 365,
  WARNING_DAYS: [3, 1], // Days before trial end to send warning
} as const;

// Data Retention
export const DATA_RETENTION = {
  USAGE_RECORDS_DAYS: 730, // 2 years
  WEBHOOK_EVENTS_DAYS: 180, // 6 months
  FAILED_PAYMENTS_DAYS: 365, // 1 year
  LOGS_DAYS: 90, // 3 months
} as const;

// System Limits
export const SYSTEM_LIMITS = {
  MAX_SUBSCRIPTIONS_PER_CUSTOMER: 5,
  MAX_PAYMENT_METHODS_PER_CUSTOMER: 10,
  MAX_PROMO_CODE_REDEMPTIONS: 1000,
  MAX_TEAM_SIZE: 100,
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Feature Flags
export const FEATURES = {
  MULTI_CURRENCY: true,
  PROMOTIONAL_CODES: true,
  USAGE_BASED_BILLING: true,
  TEAM_MANAGEMENT: true,
  ANALYTICS_DASHBOARD: true,
  DUNNING_MANAGEMENT: true,
  PRORATION: true,
} as const;

export default {
  API_VERSION,
  API_BASE_PATH,
  SUBSCRIPTION_PLANS,
  CURRENCIES,
  BILLING_INTERVALS,
  SUBSCRIPTION_STATUSES,
  INVOICE_STATUSES,
  PAYMENT_STATUSES,
  USAGE_METRICS,
  RATE_LIMITS,
  CACHE_TTL,
  PAGINATION,
  WEBHOOK_EVENTS,
  ERROR_CODES,
  EMAIL_TEMPLATES,
  TIME_PERIODS,
  ANALYTICS_GRANULARITY,
  RETRY_CONFIG,
  FILE_UPLOAD,
  DUNNING_CONFIG,
  TRIAL_CONFIG,
  DATA_RETENTION,
  SYSTEM_LIMITS,
  HTTP_STATUS,
  FEATURES,
};
