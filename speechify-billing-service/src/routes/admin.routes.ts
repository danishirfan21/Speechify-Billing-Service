import { Router } from 'express';
import {
  getDashboard,
  getCustomers,
  suspendCustomer,
  reactivateCustomer,
  getSubscriptions,
  getRevenueAnalytics,
  getSubscriptionAnalytics,
  getFailedPayments,
  retryFailedPayment,
  createPromotionalCode,
  getPromotionalCodes,
  getSystemHealth,
  exportCustomers,
} from '../controllers/admin.controller';
import { authenticateAdmin, adminRateLimiterMiddleware } from '../middleware/auth';
import { validateRequest, validateQuery } from '../middleware/validation';
import {
  adminUpdateCustomerSchema,
  adminUpdateSubscriptionSchema,
  createPromotionalCodeSchema,
  paginationSchema,
  dateRangeSchema,
  analyticsQuerySchema,
} from '../schemas/billing.schemas';

const router = Router();

// Apply admin authentication and rate limiting to all routes
router.use(authenticateAdmin);
router.use(adminRateLimiterMiddleware);

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard overview
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     metrics:
 *                       type: object
 *                       properties:
 *                         totalRevenue:
 *                           type: number
 *                         totalCustomers:
 *                           type: integer
 *                         activeSubscriptions:
 *                           type: integer
 *                         churnRate:
 *                           type: number
 *                         mrr:
 *                           type: number
 *                         arr:
 *                           type: number
 *                     recentActivity:
 *                       type: array
 *                     revenueChart:
 *                       type: array
 *                     failedPayments:
 *                       type: array
 */
router.get('/dashboard', getDashboard);

/**
 * @swagger
 * /api/admin/customers:
 *   get:
 *     summary: List all customers with admin details
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
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
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email, name, or company
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, trial, past_due, suspended]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, email, name, revenue]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Customers retrieved successfully
 */
router.get('/customers', validateQuery(paginationSchema), getCustomers);

/**
 * @swagger
 * /api/admin/customers/{id}/suspend:
 *   post:
 *     summary: Suspend customer account
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
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
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 description: Reason for suspension
 *     responses:
 *       200:
 *         description: Customer suspended successfully
 */
router.post('/customers/:id/suspend', suspendCustomer);

/**
 * @swagger
 * /api/admin/customers/{id}/reactivate:
 *   post:
 *     summary: Reactivate suspended customer
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Customer reactivated successfully
 */
router.post('/customers/:id/reactivate', reactivateCustomer);

/**
 * @swagger
 * /api/admin/subscriptions:
 *   get:
 *     summary: List all subscriptions with admin details
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
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
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, canceled, past_due, unpaid, trialing, incomplete]
 *       - in: query
 *         name: plan_type
 *         schema:
 *           type: string
 *           enum: [free, premium, pro]
 *     responses:
 *       200:
 *         description: Subscriptions retrieved successfully
 */
router.get('/subscriptions', validateQuery(paginationSchema), getSubscriptions);

/**
 * @swagger
 * /api/admin/analytics/revenue:
 *   get:
 *     summary: Get revenue analytics
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
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
 *         description: Revenue analytics retrieved successfully
 */
router.get('/analytics/revenue', validateQuery(analyticsQuerySchema), getRevenueAnalytics);

/**
 * @swagger
 * /api/admin/analytics/subscriptions:
 *   get:
 *     summary: Get subscription analytics
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
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
router.get('/analytics/subscriptions', validateQuery(dateRangeSchema), getSubscriptionAnalytics);

/**
 * @swagger
 * /api/admin/failed-payments:
 *   get:
 *     summary: Get failed payments that need attention
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
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
 *           default: 20
 *       - in: query
 *         name: resolved
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Failed payments retrieved successfully
 */
router.get('/failed-payments', validateQuery(paginationSchema), getFailedPayments);

/**
 * @swagger
 * /api/admin/failed-payments/{id}/retry:
 *   post:
 *     summary: Manually retry failed payment
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment retry initiated successfully
 */
router.post('/failed-payments/:id/retry', retryFailedPayment);

/**
 * @swagger
 * /api/admin/promotional-codes:
 *   post:
 *     summary: Create promotional code
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePromotionalCodeRequest'
 *     responses:
 *       201:
 *         description: Promotional code created successfully
 */
router.post(
  '/promotional-codes',
  validateRequest(createPromotionalCodeSchema),
  createPromotionalCode,
);

/**
 * @swagger
 * /api/admin/promotional-codes:
 *   get:
 *     summary: List promotional codes
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
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
 *           default: 20
 *       - in: query
 *         name: active_only
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Promotional codes retrieved successfully
 */
router.get('/promotional-codes', validateQuery(paginationSchema), getPromotionalCodes);

/**
 * @swagger
 * /api/admin/system/health:
 *   get:
 *     summary: Get detailed system health status
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     responses:
 *       200:
 *         description: System health status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overall_status:
 *                       type: string
 *                       enum: [healthy, unhealthy]
 *                     components:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: object
 *                         stripe:
 *                           type: object
 *                         redis:
 *                           type: object
 *                     metrics:
 *                       type: object
 */
router.get('/system/health', getSystemHealth);

/**
 * @swagger
 * /api/admin/export/customers:
 *   get:
 *     summary: Export customers data
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, xlsx, json]
 *           default: csv
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, all]
 *           default: all
 *     responses:
 *       200:
 *         description: Export initiated successfully
 */
router.get('/export/customers', validateQuery(dateRangeSchema), exportCustomers);

/**
 * @swagger
 * /api/admin/export/subscriptions:
 *   get:
 *     summary: Export subscriptions data
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, xlsx, json]
 *           default: csv
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, canceled, all]
 *           default: all
 *     responses:
 *       200:
 *         description: Export initiated successfully
 */
router.get('/export/subscriptions', async (req, res, next) => {
  try {
    const { format = 'csv', start_date, end_date, status = 'all' } = req.query;

    const exportResult = await billingService.exportSubscriptions({
      format: format as string,
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
      status: status as string,
    });

    res.json({
      success: true,
      data: exportResult,
      message: 'Export initiated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/export/revenue:
 *   get:
 *     summary: Export revenue data
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, xlsx, json]
 *           default: csv
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
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: Export initiated successfully
 */
router.get('/export/revenue', async (req, res, next) => {
  try {
    const { format = 'csv', start_date, end_date, granularity = 'day' } = req.query;

    const exportResult = await billingService.exportRevenue({
      format: format as string,
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
      granularity: granularity as string,
    });

    res.json({
      success: true,
      data: exportResult,
      message: 'Export initiated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/reports/monthly:
 *   get:
 *     summary: Get monthly business report
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *     responses:
 *       200:
 *         description: Monthly report retrieved successfully
 */
router.get('/reports/monthly', async (req, res, next) => {
  try {
    const { year, month } = req.query;

    let reportDate: Date;
    if (year && month) {
      reportDate = new Date(Number(year), Number(month) - 1, 1);
    } else {
      // Default to last month
      reportDate = new Date();
      reportDate.setMonth(reportDate.getMonth() - 1);
    }

    const report = await billingService.getMonthlyReport(reportDate);

    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/cohorts:
 *   get:
 *     summary: Get customer cohort analysis
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
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
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter]
 *           default: month
 *     responses:
 *       200:
 *         description: Cohort analysis retrieved successfully
 */
router.get('/cohorts', async (req, res, next) => {
  try {
    const { start_date, end_date, period = 'month' } = req.query;

    const startDate = start_date
      ? new Date(start_date as string)
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = end_date ? new Date(end_date as string) : new Date();

    const cohortAnalysis = await analyticsService.getCohortAnalysis(startDate, endDate);

    res.json({
      success: true,
      data: cohortAnalysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/segments:
 *   get:
 *     summary: Get customer segmentation analysis
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     responses:
 *       200:
 *         description: Customer segmentation retrieved successfully
 */
router.get('/segments', async (req, res, next) => {
  try {
    const segmentation = await analyticsService.getCustomerSegmentation();

    res.json({
      success: true,
      data: segmentation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/forecast:
 *   get:
 *     summary: Get revenue forecasting
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 24
 *           default: 12
 *     responses:
 *       200:
 *         description: Revenue forecast retrieved successfully
 */
router.get('/forecast', async (req, res, next) => {
  try {
    const { months = 12 } = req.query;

    const forecast = await analyticsService.getRevenueForecasting(Number(months));

    res.json({
      success: true,
      data: forecast,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/maintenance/cleanup:
 *   post:
 *     summary: Trigger manual cleanup of old data
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data_types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [usage_records, webhook_events, failed_payments, logs]
 *               older_than_days:
 *                 type: integer
 *                 minimum: 30
 *                 default: 365
 *     responses:
 *       200:
 *         description: Cleanup initiated successfully
 */
router.post('/maintenance/cleanup', async (req, res, next) => {
  try {
    const { data_types = ['usage_records', 'webhook_events'], older_than_days = 365 } = req.body;

    const result = await billingService.performDataCleanup({
      dataTypes: data_types,
      olderThanDays: older_than_days,
    });

    res.json({
      success: true,
      data: result,
      message: 'Cleanup initiated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/maintenance/sync:
 *   post:
 *     summary: Trigger manual sync with Stripe
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sync_types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [customers, subscriptions, invoices, payment_methods]
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 1000
 *                 default: 100
 *     responses:
 *       200:
 *         description: Sync initiated successfully
 */
router.post('/maintenance/sync', async (req, res, next) => {
  try {
    const { sync_types = ['subscriptions'], limit = 100 } = req.body;

    const result = await billingService.performStripeSync({
      syncTypes: sync_types,
      limit,
    });

    res.json({
      success: true,
      data: result,
      message: 'Sync initiated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/notifications/send:
 *   post:
 *     summary: Send manual notification to customers
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - notification_type
 *               - recipients
 *             properties:
 *               notification_type:
 *                 type: string
 *                 enum: [maintenance, feature_announcement, policy_update, custom]
 *               recipients:
 *                 type: object
 *                 properties:
 *                   customer_ids:
 *                     type: array
 *                     items:
 *                       type: string
 *                   plan_types:
 *                     type: array
 *                     items:
 *                       type: string
 *                       enum: [free, premium, pro]
 *                   all_customers:
 *                     type: boolean
 *               subject:
 *                 type: string
 *                 maxLength: 200
 *               message:
 *                 type: string
 *                 maxLength: 5000
 *               schedule_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Notification queued successfully
 */
router.post('/notifications/send', async (req, res, next) => {
  try {
    const { notification_type, recipients, subject, message, schedule_at } = req.body;

    const result = await billingService.sendBulkNotification({
      notificationType: notification_type,
      recipients,
      subject,
      message,
      scheduleAt: schedule_at ? new Date(schedule_at) : undefined,
    });

    res.json({
      success: true,
      data: result,
      message: 'Notification queued successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/config/limits:
 *   get:
 *     summary: Get system configuration and limits
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
 */
router.get('/config/limits', async (req, res, next) => {
  try {
    const config = {
      rate_limits: {
        api_requests_per_hour: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
        webhook_requests_per_hour: 1000,
        admin_requests_per_hour: 50,
      },
      billing_limits: {
        free_plan_monthly_limit: process.env.FREE_PLAN_MONTHLY_LIMIT || 10000,
        premium_plan_monthly_limit: process.env.PREMIUM_PLAN_MONTHLY_LIMIT || 100000,
        pro_plan_monthly_limit: process.env.PRO_PLAN_MONTHLY_LIMIT || 1000000,
      },
      system_limits: {
        max_webhook_retries: 3,
        max_payment_retries: 3,
        data_retention_days: 730, // 2 years
        session_timeout_hours: 24,
      },
      feature_flags: {
        multi_currency_enabled: true,
        promotional_codes_enabled: true,
        usage_based_billing_enabled: true,
        team_management_enabled: true,
      },
    };

    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/audit/logs:
 *   get:
 *     summary: Get audit logs
 *     tags: [Admin]
 *     security:
 *       - BasicAuth: []
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
 *           default: 50
 *       - in: query
 *         name: action_type
 *         schema:
 *           type: string
 *           enum: [customer_created, subscription_modified, payment_processed, admin_action]
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
 *         description: Audit logs retrieved successfully
 */
router.get('/audit/logs', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, action_type, start_date, end_date } = req.query;

    const auditLogs = await billingService.getAuditLogs({
      page: Number(page),
      limit: Number(limit),
      actionType: action_type as string,
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
    });

    res.json({
      success: true,
      data: auditLogs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export { router as adminRoutes };
