import { Router, Request, Response, NextFunction } from 'express';
import {
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  listCustomers,
  getCustomerSubscriptions,
  getCustomerInvoices,
} from '../controllers/customer.controller';
import {
  createSubscription,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  previewSubscriptionChange,
  getSubscriptionPlans,
  getUsageStats,
  recordUsage,
} from '../controllers/subscription.controller';
import { authenticateApiKey } from '../middleware/auth';
import { rateLimiterMiddleware } from '../middleware/rateLimiter';
import { validateRequest, validateQuery } from '../middleware/validation';
import { billingService } from '../services/billing.service';
import { stripeService } from '../services/stripe.service';
import { getDatabase } from '../database/connection';
import { logger } from '../utils/logger';
import {
  createCustomerSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  recordUsageSchema,
  attachPaymentMethodSchema,
  paginationSchema,
  dateRangeSchema,
  analyticsQuerySchema,
} from '../schemas/billing.schemas';

const router = Router();

// Apply rate limiting and authentication to all routes
router.use(rateLimiterMiddleware);
router.use(authenticateApiKey);

// Customer Routes
/**
 * @swagger
 * /api/billing/customers:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCustomerRequest'
 *           examples:
 *             basic:
 *               summary: Basic customer creation
 *               value:
 *                 email: "customer@example.com"
 *                 name: "John Doe"
 *             complete:
 *               summary: Complete customer with address
 *               value:
 *                 email: "business@company.com"
 *                 name: "Jane Smith"
 *                 company: "Acme Corp"
 *                 phone: "+1-555-123-4567"
 *                 address:
 *                   line1: "123 Business St"
 *                   city: "San Francisco"
 *                   state: "CA"
 *                   postal_code: "94105"
 *                   country: "US"
 *     responses:
 *       201:
 *         description: Customer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Customer'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Customer already exists
 */
router.post('/customers', validateRequest(createCustomerSchema), createCustomer);

/**
 * @swagger
 * /api/billing/customers:
 *   get:
 *     summary: List customers with pagination
 *     tags: [Customers]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email, name, or company
 *     responses:
 *       200:
 *         description: Customers retrieved successfully
 */
router.get('/customers', validateQuery(paginationSchema), listCustomers);

/**
 * @swagger
 * /api/billing/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Customer UUID
 *     responses:
 *       200:
 *         description: Customer retrieved successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/customers/:id', getCustomer);

/**
 * @swagger
 * /api/billing/customers/{id}:
 *   put:
 *     summary: Update customer information
 *     tags: [Customers]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCustomerRequest'
 *     responses:
 *       200:
 *         description: Customer updated successfully
 */
router.put('/customers/:id', validateRequest(createCustomerSchema), updateCustomer);

/**
 * @swagger
 * /api/billing/customers/{id}:
 *   delete:
 *     summary: Delete customer (soft delete)
 *     tags: [Customers]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Customer deleted successfully
 */
router.delete('/customers/:id', deleteCustomer);

// Subscription Routes
/**
 * @swagger
 * /api/billing/subscribe:
 *   post:
 *     summary: Create a new subscription
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSubscriptionRequest'
 *           examples:
 *             basic:
 *               summary: Basic subscription
 *               value:
 *                 customer_id: "550e8400-e29b-41d4-a716-446655440000"
 *                 plan_id: "550e8400-e29b-41d4-a716-446655440001"
 *             with_trial:
 *               summary: Subscription with trial
 *               value:
 *                 customer_id: "550e8400-e29b-41d4-a716-446655440000"
 *                 plan_id: "550e8400-e29b-41d4-a716-446655440001"
 *                 trial_days: 14
 *                 payment_method_id: "pm_1234567890"
 *     responses:
 *       201:
 *         description: Subscription created successfully
 */
router.post('/subscribe', validateRequest(createSubscriptionSchema), createSubscription);

/**
 * @swagger
 * /api/billing/subscription/{id}:
 *   get:
 *     summary: Get subscription details
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Subscription retrieved successfully
 */
router.get('/subscription/:id', getSubscription);

/**
 * @swagger
 * /api/billing/subscription/{id}:
 *   put:
 *     summary: Update subscription
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSubscriptionRequest'
 *           examples:
 *             upgrade_plan:
 *               summary: Upgrade to different plan
 *               value:
 *                 plan_id: "550e8400-e29b-41d4-a716-446655440002"
 *                 prorate: true
 *             change_quantity:
 *               summary: Change subscription quantity
 *               value:
 *                 quantity: 3
 *                 prorate: true
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 */
router.put('/subscription/:id', validateRequest(updateSubscriptionSchema), updateSubscription);

/**
 * @swagger
 * /api/billing/subscription/{id}:
 *   delete:
 *     summary: Cancel subscription
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: immediately
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Cancel immediately or at period end
 *     responses:
 *       200:
 *         description: Subscription canceled successfully
 */
router.delete('/subscription/:id', cancelSubscription);

/**
 * @swagger
 * /api/billing/subscription/{id}/pause:
 *   post:
 *     summary: Pause subscription
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resume_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Subscription paused successfully
 */
router.post('/subscription/:id/pause', pauseSubscription);

/**
 * @swagger
 * /api/billing/subscription/{id}/resume:
 *   post:
 *     summary: Resume paused subscription
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Subscription resumed successfully
 */
router.post('/subscription/:id/resume', resumeSubscription);

/**
 * @swagger
 * /api/billing/subscription/{id}/preview-change:
 *   post:
 *     summary: Preview subscription change costs
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plan_id:
 *                 type: string
 *                 format: uuid
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Preview generated successfully
 */
router.post('/subscription/:id/preview-change', previewSubscriptionChange);

// Subscription Plans Routes
/**
 * @swagger
 * /api/billing/plans:
 *   get:
 *     summary: Get all available subscription plans
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           enum: [usd, eur, gbp, cad, aud, jpy]
 *           default: usd
 *     responses:
 *       200:
 *         description: Subscription plans retrieved successfully
 */
router.get('/plans', getSubscriptionPlans);

// Customer Relationship Routes
/**
 * @swagger
 * /api/billing/customers/{id}/subscriptions:
 *   get:
 *     summary: Get customer's subscriptions
 *     tags: [Customers]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Customer subscriptions retrieved successfully
 */
router.get('/customers/:id/subscriptions', getCustomerSubscriptions);

/**
 * @swagger
 * /api/billing/customers/{id}/invoices:
 *   get:
 *     summary: Get customer's invoices
 *     tags: [Customers]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, open, paid, uncollectible, void]
 *     responses:
 *       200:
 *         description: Customer invoices retrieved successfully
 */
router.get('/customers/:id/invoices', getCustomerInvoices);

// Usage Tracking Routes
/**
 * @swagger
 * /api/billing/usage/{customerId}:
 *   get:
 *     summary: Get customer usage statistics
 *     tags: [Usage]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [current, previous, last30days]
 *           default: current
 *         description: Billing period to retrieve usage for
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 */
router.get('/usage/:customerId', getUsageStats);

/**
 * @swagger
 * /api/billing/usage:
 *   post:
 *     summary: Record usage for a customer
 *     tags: [Usage]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - metric_name
 *               - quantity
 *             properties:
 *               customer_id:
 *                 type: string
 *                 format: uuid
 *                 description: Customer UUID
 *               metric_name:
 *                 type: string
 *                 enum: [api_calls, characters_processed, voice_minutes, storage_mb]
 *                 description: Type of usage metric
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 1000000
 *                 description: Amount of usage to record
 *               metadata:
 *                 type: object
 *                 description: Additional metadata about the usage
 *           examples:
 *             api_call:
 *               summary: Record API calls
 *               value:
 *                 customer_id: "550e8400-e29b-41d4-a716-446655440000"
 *                 metric_name: "api_calls"
 *                 quantity: 10
 *                 metadata:
 *                   endpoint: "/api/text-to-speech"
 *                   model: "premium"
 *             characters:
 *               summary: Record character processing
 *               value:
 *                 customer_id: "550e8400-e29b-41d4-a716-446655440000"
 *                 metric_name: "characters_processed"
 *                 quantity: 1500
 *                 metadata:
 *                   language: "en-US"
 *                   voice: "neural"
 *     responses:
 *       200:
 *         description: Usage recorded successfully
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/usage', validateRequest(recordUsageSchema), recordUsage);

// Payment Methods Routes
/**
 * @swagger
 * /api/billing/customers/{id}/payment-methods:
 *   get:
 *     summary: Get customer's payment methods
 *     tags: [Billing]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment methods retrieved successfully
 */
router.get(
  '/customers/:id/payment-methods',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const paymentMethods = await billingService.getCustomerPaymentMethods(id);

      res.json({
        success: true,
        data: paymentMethods,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/billing/payment-methods/attach:
 *   post:
 *     summary: Attach payment method to customer
 *     tags: [Billing]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payment_method_id
 *               - customer_id
 *             properties:
 *               payment_method_id:
 *                 type: string
 *                 description: Stripe payment method ID
 *               customer_id:
 *                 type: string
 *                 format: uuid
 *                 description: Customer UUID
 *               set_as_default:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Payment method attached successfully
 */
router.post(
  '/payment-methods/attach',
  validateRequest(attachPaymentMethodSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { payment_method_id, customer_id, set_as_default = false } = req.body;

      const customer = await billingService.getCustomer(customer_id);
      if (!customer) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer not found',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const paymentMethod = await stripeService.attachPaymentMethod(
        payment_method_id,
        customer.stripe_customer_id,
      );

      if (set_as_default) {
        await stripeService.setDefaultPaymentMethod(customer.stripe_customer_id, payment_method_id);
      }

      // Save to database
      await billingService.savePaymentMethod({
        stripe_payment_method_id: paymentMethod.id,
        customer_id,
        type: paymentMethod.type,
        card_brand: paymentMethod.card?.brand,
        card_last_four: paymentMethod.card?.last4,
        card_exp_month: paymentMethod.card?.exp_month,
        card_exp_year: paymentMethod.card?.exp_year,
        is_default: set_as_default,
      });

      res.json({
        success: true,
        data: paymentMethod,
        message: 'Payment method attached successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/billing/payment-methods/{id}:
 *   delete:
 *     summary: Detach payment method from customer
 *     tags: [Billing]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Stripe payment method ID
 *     responses:
 *       200:
 *         description: Payment method detached successfully
 */
router.delete(
  '/payment-methods/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const db = getDatabase();

      await stripeService.detachPaymentMethod(id);

      // Remove from database
      await db('payment_methods').where('stripe_payment_method_id', id).delete();

      res.json({
        success: true,
        message: 'Payment method detached successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Analytics Routes
/**
 * @swagger
 * /api/billing/analytics/subscriptions:
 *   get:
 *     summary: Get subscription analytics
 *     tags: [Analytics]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Subscription analytics retrieved successfully
 */
router.get(
  '/analytics/subscriptions',
  validateQuery(dateRangeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { start_date, end_date } = req.query;

      const startDate = start_date ? new Date(start_date as string) : undefined;
      const endDate = end_date ? new Date(end_date as string) : undefined;

      const analytics = await billingService.getSubscriptionAnalytics(startDate, endDate);

      res.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/billing/analytics/usage:
 *   get:
 *     summary: Get usage analytics
 *     tags: [Analytics]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Usage analytics retrieved successfully
 */
router.get(
  '/analytics/usage',
  validateQuery(dateRangeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { start_date, end_date } = req.query;

      const startDate = start_date ? new Date(start_date as string) : undefined;
      const endDate = end_date ? new Date(end_date as string) : undefined;

      const analytics = await billingService.getUsageAnalytics(startDate, endDate);

      res.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Health Check Route
/**
 * @swagger
 * /api/billing/health:
 *   get:
 *     summary: Service health check
 *     tags: [Health]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const health = await billingService.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export { router as billingRoutes };
