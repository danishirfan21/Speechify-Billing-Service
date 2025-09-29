import { Request, Response, NextFunction } from 'express';
import { billingService } from '../services/billing.service';
import { stripeService } from '../services/stripe.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * @swagger
 * tags:
 *   name: Billing
 *   description: Billing and payment operations
 */

/**
 * @swagger
 * /api/billing/payment-methods/create-setup-intent:
 *   post:
 *     summary: Create payment method setup intent
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
 *               - customer_id
 *             properties:
 *               customer_id:
 *                 type: string
 *                 format: uuid
 *                 description: Customer UUID
 *               usage:
 *                 type: string
 *                 enum: [on_session, off_session]
 *                 default: off_session
 *     responses:
 *       200:
 *         description: Setup intent created successfully
 */
export const createSetupIntent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customer_id, usage = 'off_session' } = req.body;

    // Get customer
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

    // Create setup intent in Stripe
    const setupIntent = await stripeService.createSetupIntent(customer.stripe_customer_id, usage);

    logger.info('Setup intent created', {
      customerId: customer_id,
      setupIntentId: setupIntent.id,
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      data: {
        client_secret: setupIntent.client_secret,
        setup_intent_id: setupIntent.id,
      },
      message: 'Setup intent created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/payment-intents:
 *   post:
 *     summary: Create payment intent for one-time payment
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
 *               - amount
 *               - currency
 *               - customer_id
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.5
 *                 description: Amount in dollars
 *               currency:
 *                 type: string
 *                 enum: [usd, eur, gbp, cad, aud, jpy]
 *                 default: usd
 *               customer_id:
 *                 type: string
 *                 format: uuid
 *               payment_method_id:
 *                 type: string
 *                 description: Stripe payment method ID
 *               description:
 *                 type: string
 *                 maxLength: 200
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Payment intent created successfully
 */
export const createPaymentIntent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      amount,
      currency = 'usd',
      customer_id,
      payment_method_id,
      description,
      metadata,
    } = req.body;

    // Get customer
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

    // Create payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      customer: customer.stripe_customer_id,
      payment_method: payment_method_id,
      description,
      metadata: {
        customer_id,
        ...metadata,
      },
    });

    logger.info('Payment intent created', {
      customerId: customer_id,
      paymentIntentId: paymentIntent.id,
      amount,
      currency,
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      data: {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
      },
      message: 'Payment intent created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/payment-intents/{id}/confirm:
 *   post:
 *     summary: Confirm payment intent
 *     tags: [Billing]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment Intent ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               payment_method_id:
 *                 type: string
 *                 description: Payment method to use for confirmation
 *               return_url:
 *                 type: string
 *                 format: uri
 *                 description: URL to redirect to after payment
 *     responses:
 *       200:
 *         description: Payment intent confirmed successfully
 */
export const confirmPaymentIntent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { payment_method_id, return_url } = req.body;

    const paymentIntent = await stripeService.confirmPaymentIntent(id, {
      payment_method: payment_method_id,
      return_url,
    });

    logger.info('Payment intent confirmed', {
      paymentIntentId: id,
      status: paymentIntent.status,
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      data: {
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
        client_secret: paymentIntent.client_secret,
      },
      message: 'Payment intent confirmed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/refunds:
 *   post:
 *     summary: Create refund for payment
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
 *               - payment_intent_id
 *             properties:
 *               payment_intent_id:
 *                 type: string
 *                 description: Payment Intent ID to refund
 *               amount:
 *                 type: number
 *                 description: Amount to refund (partial refund), leave empty for full refund
 *               reason:
 *                 type: string
 *                 enum: [duplicate, fraudulent, requested_by_customer, expired_uncaptured_charge]
 *                 default: requested_by_customer
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Refund created successfully
 */
export const createRefund = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { payment_intent_id, amount, reason = 'requested_by_customer', metadata } = req.body;

    const refund = await stripeService.createRefund({
      payment_intent: payment_intent_id,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason,
      metadata,
    });

    logger.info('Refund created', {
      refundId: refund.id,
      paymentIntentId: payment_intent_id,
      amount: refund.amount / 100,
      reason,
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      data: {
        refund_id: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status,
      },
      message: 'Refund created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/tax-rates:
 *   get:
 *     summary: Get available tax rates
 *     tags: [Billing]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *           minLength: 2
 *           maxLength: 2
 *         description: Country code (ISO 3166-1 alpha-2)
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State or province code
 *     responses:
 *       200:
 *         description: Tax rates retrieved successfully
 */
export const getTaxRates = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { country, state } = req.query;

    const taxRates = await stripeService.getTaxRates({
      country: country as string,
      state: state as string,
    });

    res.json({
      success: true,
      data: taxRates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/upcoming-invoice:
 *   get:
 *     summary: Preview upcoming invoice for customer
 *     tags: [Billing]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: customer_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: subscription_id
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Upcoming invoice preview retrieved successfully
 */
export const getUpcomingInvoice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customer_id, subscription_id } = req.query;

    if (!customer_id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const customer = await billingService.getCustomer(customer_id as string);
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

    let stripeSubscriptionId: string | undefined;
    if (subscription_id) {
      const subscription = await billingService.getSubscription(subscription_id as string);
      if (subscription) {
        stripeSubscriptionId = subscription.stripe_subscription_id;
      }
    }

    const upcomingInvoice = await stripeService.getUpcomingInvoice(
      customer.stripe_customer_id,
      stripeSubscriptionId,
    );

    res.json({
      success: true,
      data: {
        id: upcomingInvoice.id,
        amount_due: upcomingInvoice.amount_due / 100,
        amount_paid: upcomingInvoice.amount_paid / 100,
        amount_remaining: upcomingInvoice.amount_remaining / 100,
        currency: upcomingInvoice.currency,
        period_start: new Date(upcomingInvoice.period_start * 1000),
        period_end: new Date(upcomingInvoice.period_end * 1000),
        subtotal: upcomingInvoice.subtotal / 100,
        tax: upcomingInvoice.tax ? upcomingInvoice.tax / 100 : 0,
        total: upcomingInvoice.total / 100,
        lines: upcomingInvoice.lines.data.map((line) => ({
          id: line.id,
          amount: line.amount / 100,
          currency: line.currency,
          description: line.description,
          period: {
            start: new Date(line.period.start * 1000),
            end: new Date(line.period.end * 1000),
          },
          proration: line.proration,
          quantity: line.quantity,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/balance:
 *   get:
 *     summary: Get account balance and transaction summary
 *     tags: [Billing]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: customer_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Account balance retrieved successfully
 */
export const getAccountBalance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customer_id } = req.query;

    if (!customer_id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const customer = await billingService.getCustomer(customer_id as string);
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

    // Get customer balance from Stripe
    const customerBalance = await stripeService.getCustomerBalance(customer.stripe_customer_id);

    // Get recent transactions
    const recentInvoices = await billingService.getCustomerInvoices(customer_id as string, 10);

    // Calculate summary
    const totalPaid = recentInvoices.reduce(
      (sum, invoice) => sum + (invoice.status === 'paid' ? invoice.amount_paid : 0),
      0,
    );

    const totalOutstanding = recentInvoices.reduce(
      (sum, invoice) => sum + (invoice.status === 'open' ? invoice.amount_due : 0),
      0,
    );

    res.json({
      success: true,
      data: {
        balance: customerBalance / 100, // Convert from cents
        currency: customer.currency,
        total_paid: totalPaid,
        total_outstanding: totalOutstanding,
        recent_invoices: recentInvoices.slice(0, 5), // Latest 5 invoices
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/subscription-preview:
 *   post:
 *     summary: Preview subscription cost before creation
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
 *               - customer_id
 *               - plan_id
 *             properties:
 *               customer_id:
 *                 type: string
 *                 format: uuid
 *               plan_id:
 *                 type: string
 *                 format: uuid
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *               promo_code:
 *                 type: string
 *               trial_days:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 365
 *     responses:
 *       200:
 *         description: Subscription preview generated successfully
 */
export const previewSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customer_id, plan_id, quantity = 1, promo_code, trial_days } = req.body;

    // Get customer and plan
    const [customer, plan] = await Promise.all([
      billingService.getCustomer(customer_id),
      billingService.getSubscriptionPlan(plan_id),
    ]);

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

    if (!plan) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Subscription plan not found',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Generate preview
    const preview = await stripeService.previewSubscription({
      customer: customer.stripe_customer_id,
      items: [
        {
          price: plan.stripe_price_id,
          quantity,
        },
      ],
      coupon: promo_code,
      trial_period_days: trial_days,
    });

    res.json({
      success: true,
      data: {
        plan: {
          id: plan.id,
          name: plan.name,
          amount: plan.amount,
          currency: plan.currency,
          billing_interval: plan.billing_interval,
        },
        preview: {
          subtotal: preview.amount_subtotal / 100,
          total: preview.amount_total / 100,
          currency: preview.currency,
          tax: preview.total_tax_amounts.reduce((sum, tax) => sum + tax.amount, 0) / 100,
          discount:
            preview.total_discount_amounts.reduce((sum, discount) => sum + discount.amount, 0) /
            100,
          trial_days,
          first_payment_date: trial_days
            ? new Date(Date.now() + trial_days * 24 * 60 * 60 * 1000)
            : new Date(),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/download-invoice/{invoiceId}:
 *   get:
 *     summary: Generate download link for invoice
 *     tags: [Billing]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invoice download link generated successfully
 */
export const downloadInvoice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { invoiceId } = req.params;

    // Get invoice from database
    const invoice = await billingService.getInvoice(invoiceId);
    if (!invoice) {
      res.status(404).json({
        success: false,
        error: {
          code: 'INVOICE_NOT_FOUND',
          message: 'Invoice not found',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Get invoice PDF from Stripe
    const stripeInvoice = await stripeService.getInvoice(invoice.stripe_invoice_id);

    if (!stripeInvoice.invoice_pdf) {
      res.status(404).json({
        success: false,
        error: {
          code: 'INVOICE_PDF_NOT_AVAILABLE',
          message: 'Invoice PDF is not available',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        download_url: stripeInvoice.invoice_pdf,
        hosted_url: stripeInvoice.hosted_invoice_url,
        invoice_number: stripeInvoice.number,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
      message: 'Invoice download link generated',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/payment-history:
 *   get:
 *     summary: Get customer payment history
 *     tags: [Billing]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: customer_id
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
 *           default: 20
 *       - in: query
 *         name: starting_after
 *         schema:
 *           type: string
 *         description: Cursor for pagination
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
 */
export const getPaymentHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customer_id, limit = 20, starting_after } = req.query;

    if (!customer_id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const customer = await billingService.getCustomer(customer_id as string);
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

    // Get payment history from Stripe
    const paymentIntents = await stripeService.listPaymentIntents({
      customer: customer.stripe_customer_id,
      limit: Number(limit),
      starting_after: starting_after as string,
    });

    const paymentHistory = paymentIntents.data.map((payment) => ({
      id: payment.id,
      amount: payment.amount / 100,
      currency: payment.currency,
      status: payment.status,
      description: payment.description,
      created: new Date(payment.created * 1000),
      payment_method: payment.payment_method,
    }));

    res.json({
      success: true,
      data: {
        payments: paymentHistory,
        has_more: paymentIntents.has_more,
        total_count: paymentIntents.data.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/billing/payment-methods/{id}/set-default:
 *   post:
 *     summary: Set payment method as default
 *     tags: [Billing]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *     responses:
 *       200:
 *         description: Default payment method updated successfully
 */
export const setDefaultPaymentMethod = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    // Get payment method from database
    const paymentMethod = await billingService.getPaymentMethod(id);
    if (!paymentMethod) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PAYMENT_METHOD_NOT_FOUND',
          message: 'Payment method not found',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Get customer
    const customer = await billingService.getCustomer(paymentMethod.customer_id);
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

    // Update default payment method in Stripe
    await stripeService.setDefaultPaymentMethod(
      customer.stripe_customer_id,
      paymentMethod.stripe_payment_method_id,
    );

    // Update in database
    await billingService.updateDefaultPaymentMethod(paymentMethod.customer_id, id);

    logger.info('Default payment method updated', {
      customerId: customer.id,
      paymentMethodId: id,
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      message: 'Default payment method updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
