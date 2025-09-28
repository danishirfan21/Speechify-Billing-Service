import { Options } from 'swagger-jsdoc';

export const swaggerOptions: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Speechify Billing Service API',
      version: '1.0.0',
      description: 'A comprehensive subscription management microservice with Stripe integration',
      contact: {
        name: 'Speechify Engineering',
        email: 'engineering@speechify.com',
        url: 'https://speechify.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === 'production'
            ? 'https://api.speechify.com'
            : `http://localhost:${process.env.PORT || 3000}`,
        description:
          process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key for authentication',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authenticated requests',
        },
        BasicAuth: {
          type: 'http',
          scheme: 'basic',
          description: 'Basic authentication for admin endpoints',
        },
      },
      schemas: {
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Unique customer identifier' },
            stripe_customer_id: { type: 'string', description: 'Stripe customer ID' },
            email: { type: 'string', format: 'email', description: 'Customer email address' },
            name: { type: 'string', description: 'Customer full name' },
            company: { type: 'string', description: 'Company name' },
            phone: { type: 'string', description: 'Phone number' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'stripe_customer_id', 'email'],
        },
        CreateCustomerRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email', description: 'Customer email address' },
            name: { type: 'string', description: 'Customer full name' },
            company: { type: 'string', description: 'Company name' },
            phone: { type: 'string', description: 'Phone number' },
            address: {
              type: 'object',
              properties: {
                line1: { type: 'string' },
                line2: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                postal_code: { type: 'string' },
                country: { type: 'string', minLength: 2, maxLength: 2 },
              },
            },
            tax_id: { type: 'string', description: 'Tax identification number' },
          },
          required: ['email'],
        },
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            stripe_subscription_id: { type: 'string' },
            customer_id: { type: 'string', format: 'uuid' },
            plan_id: { type: 'string', format: 'uuid' },
            status: {
              type: 'string',
              enum: [
                'active',
                'canceled',
                'past_due',
                'unpaid',
                'trialing',
                'incomplete',
                'incomplete_expired',
              ],
            },
            current_period_start: { type: 'string', format: 'date-time' },
            current_period_end: { type: 'string', format: 'date-time' },
            trial_start: { type: 'string', format: 'date-time', nullable: true },
            trial_end: { type: 'string', format: 'date-time', nullable: true },
            cancel_at: { type: 'string', format: 'date-time', nullable: true },
            canceled_at: { type: 'string', format: 'date-time', nullable: true },
            cancel_at_period_end: { type: 'boolean' },
            quantity: { type: 'integer', minimum: 1 },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateSubscriptionRequest: {
          type: 'object',
          properties: {
            customer_id: { type: 'string', format: 'uuid', description: 'Customer UUID' },
            plan_id: { type: 'string', format: 'uuid', description: 'Subscription plan UUID' },
            payment_method_id: { type: 'string', description: 'Stripe payment method ID' },
            trial_days: {
              type: 'integer',
              minimum: 0,
              maximum: 365,
              description: 'Trial period in days',
            },
            promo_code: { type: 'string', description: 'Promotional code' },
            quantity: { type: 'integer', minimum: 1, maximum: 1000, default: 1 },
          },
          required: ['customer_id', 'plan_id'],
        },
        SubscriptionPlan: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', description: 'Plan name' },
            description: { type: 'string', description: 'Plan description' },
            plan_type: { type: 'string', enum: ['free', 'premium', 'pro'] },
            amount: { type: 'number', minimum: 0, description: 'Price in dollars' },
            currency: { type: 'string', enum: ['usd', 'eur', 'gbp', 'cad', 'aud', 'jpy'] },
            billing_interval: { type: 'string', enum: ['month', 'year'] },
            usage_limit: { type: 'integer', minimum: 0, description: 'Monthly usage limit' },
            is_active: { type: 'boolean' },
          },
        },
        UsageStats: {
          type: 'object',
          properties: {
            customer_id: { type: 'string', format: 'uuid' },
            current_period_usage: {
              type: 'integer',
              description: 'Usage in current billing period',
            },
            current_period_limit: {
              type: 'integer',
              description: 'Usage limit for current period',
            },
            usage_percentage: { type: 'number', minimum: 0, maximum: 100 },
            overage_amount: { type: 'integer', minimum: 0 },
            last_updated: { type: 'string', format: 'date-time' },
            usage_by_metric: {
              type: 'object',
              additionalProperties: { type: 'integer' },
            },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            stripe_invoice_id: { type: 'string' },
            customer_id: { type: 'string', format: 'uuid' },
            invoice_number: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'open', 'paid', 'uncollectible', 'void'] },
            amount_due: { type: 'number', minimum: 0 },
            amount_paid: { type: 'number', minimum: 0 },
            currency: { type: 'string', enum: ['usd', 'eur', 'gbp', 'cad', 'aud', 'jpy'] },
            due_date: { type: 'string', format: 'date-time' },
            paid_at: { type: 'string', format: 'date-time', nullable: true },
            hosted_invoice_url: { type: 'string', format: 'uri' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', description: 'Response data' },
            message: { type: 'string', description: 'Response message' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['success'],
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', description: 'Error code' },
                message: { type: 'string', description: 'Error message' },
                details: { type: 'object', description: 'Additional error details' },
              },
              required: ['code', 'message'],
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['success', 'error'],
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad request - validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Request validation failed',
                  details: {
                    field: 'email',
                    message: 'Please provide a valid email address',
                  },
                },
                timestamp: '2024-01-15T10:30:00Z',
              },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized - authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'API key required',
                },
                timestamp: '2024-01-15T10:30:00Z',
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'Customer not found',
                },
                timestamp: '2024-01-15T10:30:00Z',
              },
            },
          },
        },
        TooManyRequests: {
          description: 'Too many requests - rate limit exceeded',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'RATE_LIMIT_EXCEEDED',
                  message: 'Too many requests. Please try again later.',
                  retryAfter: 60,
                },
                timestamp: '2024-01-15T10:30:00Z',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'INTERNAL_SERVER_ERROR',
                  message: 'An unexpected error occurred',
                },
                timestamp: '2024-01-15T10:30:00Z',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Customers',
        description: 'Customer management endpoints',
      },
      {
        name: 'Subscriptions',
        description: 'Subscription lifecycle management',
      },
      {
        name: 'Billing',
        description: 'Billing and payment operations',
      },
      {
        name: 'Usage',
        description: 'Usage tracking and analytics',
      },
      {
        name: 'Webhooks',
        description: 'Stripe webhook handling',
      },
      {
        name: 'Admin',
        description: 'Administrative operations',
      },
      {
        name: 'Health',
        description: 'Service health and monitoring',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/routes/**/*.ts'],
};
