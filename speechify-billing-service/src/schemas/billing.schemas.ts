import Joi from 'joi';

// Customer schemas
export const createCustomerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  name: Joi.string().min(1).max(255).optional(),
  company: Joi.string().min(1).max(255).optional(),
  phone: Joi.string()
    .pattern(/^\+?[\d\s-()]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
    }),
  address: Joi.object({
    line1: Joi.string().max(255).optional(),
    line2: Joi.string().max(255).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    postal_code: Joi.string().max(20).optional(),
    country: Joi.string().length(2).uppercase().optional().messages({
      'string.length': 'Country code must be 2 characters (ISO 3166-1 alpha-2)',
    }),
  }).optional(),
  tax_id: Joi.string().max(100).optional(),
});

// Subscription schemas
export const createSubscriptionSchema = Joi.object({
  customer_id: Joi.string().uuid().required().messages({
    'string.uuid': 'Customer ID must be a valid UUID',
    'any.required': 'Customer ID is required',
  }),
  plan_id: Joi.string().uuid().required().messages({
    'string.uuid': 'Plan ID must be a valid UUID',
    'any.required': 'Plan ID is required',
  }),
  payment_method_id: Joi.string().optional(),
  trial_days: Joi.number().integer().min(0).max(365).optional().messages({
    'number.min': 'Trial days must be at least 0',
    'number.max': 'Trial days cannot exceed 365',
  }),
  promo_code: Joi.string().max(100).optional(),
  quantity: Joi.number().integer().min(1).max(1000).default(1).messages({
    'number.min': 'Quantity must be at least 1',
    'number.max': 'Quantity cannot exceed 1000',
  }),
});

export const updateSubscriptionSchema = Joi.object({
  plan_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'Plan ID must be a valid UUID',
  }),
  quantity: Joi.number().integer().min(1).max(1000).optional().messages({
    'number.min': 'Quantity must be at least 1',
    'number.max': 'Quantity cannot exceed 1000',
  }),
  prorate: Joi.boolean().default(true),
  cancel_at_period_end: Joi.boolean().optional(),
  promo_code: Joi.string().max(100).optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided for update',
  });

// Usage tracking schemas
export const recordUsageSchema = Joi.object({
  customer_id: Joi.string().uuid().required().messages({
    'string.uuid': 'Customer ID must be a valid UUID',
    'any.required': 'Customer ID is required',
  }),
  metric_name: Joi.string()
    .valid('api_calls', 'characters_processed', 'voice_minutes', 'storage_mb')
    .required()
    .messages({
      'any.only':
        'Metric name must be one of: api_calls, characters_processed, voice_minutes, storage_mb',
      'any.required': 'Metric name is required',
    }),
  quantity: Joi.number().integer().min(1).max(1000000).required().messages({
    'number.min': 'Quantity must be at least 1',
    'number.max': 'Quantity cannot exceed 1,000,000',
    'any.required': 'Quantity is required',
  }),
  metadata: Joi.object().optional(),
});

// Payment method schemas
export const attachPaymentMethodSchema = Joi.object({
  payment_method_id: Joi.string().required().messages({
    'any.required': 'Payment method ID is required',
  }),
  customer_id: Joi.string().uuid().required().messages({
    'string.uuid': 'Customer ID must be a valid UUID',
    'any.required': 'Customer ID is required',
  }),
  set_as_default: Joi.boolean().default(false),
});

// Subscription plan schemas
export const createSubscriptionPlanSchema = Joi.object({
  name: Joi.string().min(1).max(255).required().messages({
    'any.required': 'Plan name is required',
  }),
  description: Joi.string().max(1000).optional(),
  plan_type: Joi.string().valid('free', 'premium', 'pro').required().messages({
    'any.only': 'Plan type must be one of: free, premium, pro',
    'any.required': 'Plan type is required',
  }),
  amount: Joi.number().min(0).max(99999.99).required().messages({
    'number.min': 'Amount must be at least 0',
    'number.max': 'Amount cannot exceed $99,999.99',
    'any.required': 'Amount is required',
  }),
  currency: Joi.string().valid('usd', 'eur', 'gbp', 'cad', 'aud', 'jpy').default('usd').messages({
    'any.only': 'Currency must be one of: usd, eur, gbp, cad, aud, jpy',
  }),
  billing_interval: Joi.string().valid('month', 'year').required().messages({
    'any.only': 'Billing interval must be either month or year',
    'any.required': 'Billing interval is required',
  }),
  billing_interval_count: Joi.number().integer().min(1).max(12).default(1).messages({
    'number.min': 'Billing interval count must be at least 1',
    'number.max': 'Billing interval count cannot exceed 12',
  }),
  usage_limit: Joi.number().integer().min(0).optional().messages({
    'number.min': 'Usage limit must be at least 0',
  }),
  features: Joi.object().optional(),
  stripe_product_id: Joi.string().required().messages({
    'any.required': 'Stripe product ID is required',
  }),
  stripe_price_id: Joi.string().required().messages({
    'any.required': 'Stripe price ID is required',
  }),
});

// Promotional code schemas
export const createPromotionalCodeSchema = Joi.object({
  code: Joi.string().min(3).max(50).alphanum().uppercase().required().messages({
    'string.min': 'Code must be at least 3 characters',
    'string.max': 'Code cannot exceed 50 characters',
    'string.alphanum': 'Code must contain only letters and numbers',
    'any.required': 'Promotional code is required',
  }),
  name: Joi.string().max(255).optional(),
  percent_off: Joi.number()
    .min(1)
    .max(100)
    .when('amount_off', {
      is: Joi.exist(),
      then: Joi.forbidden(),
      otherwise: Joi.optional(),
    })
    .messages({
      'number.min': 'Percent off must be at least 1%',
      'number.max': 'Percent off cannot exceed 100%',
      'any.unknown': 'Cannot specify both percent_off and amount_off',
    }),
  amount_off: Joi.number()
    .min(0.01)
    .max(99999.99)
    .when('percent_off', {
      is: Joi.exist(),
      then: Joi.forbidden(),
      otherwise: Joi.optional(),
    })
    .messages({
      'number.min': 'Amount off must be at least $0.01',
      'number.max': 'Amount off cannot exceed $99,999.99',
    }),
  currency: Joi.string()
    .valid('usd', 'eur', 'gbp', 'cad', 'aud', 'jpy')
    .when('amount_off', {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    })
    .messages({
      'any.only': 'Currency must be one of: usd, eur, gbp, cad, aud, jpy',
      'any.required': 'Currency is required when amount_off is specified',
    }),
  duration: Joi.string().valid('once', 'repeating', 'forever').required().messages({
    'any.only': 'Duration must be one of: once, repeating, forever',
    'any.required': 'Duration is required',
  }),
  duration_in_months: Joi.number()
    .integer()
    .min(1)
    .max(36)
    .when('duration', {
      is: 'repeating',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    })
    .messages({
      'number.min': 'Duration in months must be at least 1',
      'number.max': 'Duration in months cannot exceed 36',
      'any.required': 'Duration in months is required for repeating coupons',
    }),
  max_redemptions: Joi.number().integer().min(1).optional().messages({
    'number.min': 'Max redemptions must be at least 1',
  }),
  expires_at: Joi.date().min('now').optional().messages({
    'date.min': 'Expiration date must be in the future',
  }),
})
  .or('percent_off', 'amount_off')
  .messages({
    'object.missing': 'Either percent_off or amount_off must be specified',
  });

// Query parameter schemas
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.min': 'Page must be at least 1',
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100',
  }),
  sort: Joi.string()
    .valid('created_at', 'updated_at', 'name', 'email', 'amount')
    .default('created_at'),
  order: Joi.string().valid('asc', 'desc').default('desc'),
});

export const dateRangeSchema = Joi.object({
  start_date: Joi.date().iso().optional().messages({
    'date.format': 'Start date must be in ISO format (YYYY-MM-DD)',
  }),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional().messages({
    'date.format': 'End date must be in ISO format (YYYY-MM-DD)',
    'date.min': 'End date must be after start date',
  }),
});

// Analytics schemas
export const analyticsQuerySchema = Joi.object({
  ...dateRangeSchema.describe().keys,
  granularity: Joi.string().valid('day', 'week', 'month', 'year').default('month').messages({
    'any.only': 'Granularity must be one of: day, week, month, year',
  }),
  metrics: Joi.array()
    .items(Joi.string().valid('revenue', 'subscriptions', 'churn', 'usage', 'customers'))
    .min(1)
    .default(['revenue', 'subscriptions'])
    .messages({
      'array.min': 'At least one metric must be specified',
    }),
});

// Admin schemas
export const adminUpdateCustomerSchema = Joi.object({
  ...createCustomerSchema.describe().keys,
  is_active: Joi.boolean().optional(),
  notes: Joi.string().max(1000).optional(),
});

export const adminUpdateSubscriptionSchema = Joi.object({
  ...updateSubscriptionSchema.describe().keys,
  status: Joi.string()
    .valid('active', 'canceled', 'past_due', 'unpaid', 'trialing', 'incomplete')
    .optional(),
  force_update: Joi.boolean().default(false),
});
