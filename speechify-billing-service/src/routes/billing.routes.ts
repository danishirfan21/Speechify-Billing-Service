import { Router, Request, Response, NextFunction } from 'express';
import { billingService } from '../services/billing.service';
import { stripeService } from '../services/stripe.service';
import { validateRequest } from '../middleware/validation';
import { rateLimiter } from '../middleware/rateLimiter';
import { authenticateApiKey } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  createCustomerSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
} from '../schemas/billing.schemas';

const router = Router();

// Apply rate limiting and authentication to all routes
router.use(rateLimiter);
router.use(authenticateApiKey);

// POST /api/billing/customers - Create customer
router.post(
  '/customers',
  validateRequest(createCustomerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customer = await billingService.createCustomer(req.body);

      res.status(201).json({
        success: true,
        data: customer,
        message: 'Customer created successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/billing/customers/:id - Get customer
router.get('/customers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const customer = await billingService.getCustomer(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/billing/customers/:id - Update customer
router.put(
  '/customers/:id',
  validateRequest(createCustomerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const customer = await billingService.updateCustomer(id, req.body);

      res.json({
        success: true,
        data: customer,
        message: 'Customer updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/billing/subscribe - Create subscription
router.post(
  '/subscribe',
  validateRequest(createSubscriptionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subscription = await billingService.createSubscription(req.body);

      res.status(201).json({
        success: true,
        data: subscription,
        message: 'Subscription created successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

// PUT /api/billing/subscription/:id - Update subscription
router.put(
  '/subscription/:id',
  validateRequest(updateSubscriptionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const subscription = await billingService.updateSubscription(id, req.body);

      res.json({
        success: true,
        data: subscription,
        message: 'Subscription updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/billing/subscription/:id - Cancel subscription
router.delete('/subscription/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { immediately } = req.query;

    const subscription = await billingService.cancelSubscription(id, immediately === 'true');

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription canceled successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/billing/subscription/:id - Get subscription
router.get('/subscription/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const subscription = await billingService.getSubscription(id);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
    }

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/billing/customers/:id/subscriptions - Get customer subscriptions
router.get(
  '/customers/:id/subscriptions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const subscriptions = await billingService.getCustomerSubscriptions(id);

      res.json({
        success: true,
        data: subscriptions,
      });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/billing/usage/:customerId - Get usage statistics
router.get('/usage/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const usageStats = await billingService.getUsageStats(customerId);

    res.json({
      success: true,
      data: usageStats,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/billing/usage - Record usage
router.post('/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customer_id, metric_name, quantity, metadata } = req.body;

    await billingService.recordUsage(customer_id, metric_name, quantity, metadata);

    res.json({
      success: true,
      message: 'Usage recorded successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/billing/plans - Get all subscription plans
router.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await billingService.getAllSubscriptionPlans();

    res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/billing/customers/:id/invoices - Get customer invoices
router.get('/customers/:id/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;

    const invoices = await billingService.getCustomerInvoices(id, Number(limit));

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/billing/customers/:id/payment-methods - Get customer payment methods
router.get(
  '/customers/:id/payment-methods',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const paymentMethods = await billingService.getCustomerPaymentMethods(id);

      res.json({
        success: true,
        data: paymentMethods,
      });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/billing/payment-methods/attach - Attach payment method
router.post('/payment-methods/attach', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { payment_method_id, customer_id } = req.body;

    const customer = await billingService.getCustomer(customer_id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const paymentMethod = await stripeService.attachPaymentMethod(
      payment_method_id,
      customer.stripe_customer_id,
    );

    res.json({
      success: true,
      data: paymentMethod,
      message: 'Payment method attached successfully',
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/billing/payment-methods/:id - Detach payment method
router.delete('/payment-methods/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await stripeService.detachPaymentMethod(id);

    res.json({
      success: true,
      message: 'Payment method detached successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/billing/analytics/subscriptions - Get subscription analytics
router.get('/analytics/subscriptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start_date, end_date } = req.query;

    const startDate = start_date ? new Date(start_date as string) : undefined;
    const endDate = end_date ? new Date(end_date as string) : undefined;

    const analytics = await billingService.getSubscriptionAnalytics(startDate, endDate);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/billing/analytics/usage - Get usage analytics
router.get('/analytics/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start_date, end_date } = req.query;

    const startDate = start_date ? new Date(start_date as string) : undefined;
    const endDate = end_date ? new Date(end_date as string) : undefined;

    const analytics = await billingService.getUsageAnalytics(startDate, endDate);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/billing/health - Health check
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await billingService.healthCheck();

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health,
    });
  } catch (error) {
    next(error);
  }
});

export { router as billingRoutes };
