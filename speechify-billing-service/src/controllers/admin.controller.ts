import { Request, Response, NextFunction } from 'express';
import { billingService } from '../services/billing.service';
import { analyticsService } from '../services/analytics.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative operations
 */

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard data
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
 *                       items:
 *                         type: object
 */
export const getDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const [metrics, recentActivity, revenueChart, failedPayments] = await Promise.all([
      analyticsService.getDashboardMetrics(),
      analyticsService.getRecentActivity(),
      analyticsService.getRevenueChart(),
      billingService.getFailedPayments(),
    ]);

    res.json({
      success: true,
      data: {
        metrics,
        recentActivity,
        revenueChart,
        failedPayments,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, trial, past_due]
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
export const getCustomers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    const result = await billingService.listCustomersAdmin({
      page: Number(page),
      limit: Number(limit),
      search: search as string,
      status: status as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for suspension
 *     responses:
 *       200:
 *         description: Customer suspended successfully
 */
export const suspendCustomer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await billingService.suspendCustomer(id, reason);

    logger.warn('Customer suspended by admin', {
      customerId: id,
      reason,
      adminUser: req.user?.email,
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      message: 'Customer suspended successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
export const reactivateCustomer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    await billingService.reactivateCustomer(id);

    logger.info('Customer reactivated by admin', {
      customerId: id,
      adminUser: req.user?.email,
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      message: 'Customer reactivated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 *           enum: [active, canceled, past_due, unpaid, trialing]
 *       - in: query
 *         name: plan_type
 *         schema:
 *           type: string
 *           enum: [free, premium, pro]
 *     responses:
 *       200:
 *         description: Subscriptions retrieved successfully
 */
export const getSubscriptions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page = 1, limit = 20, status, plan_type } = req.query;

    const result = await billingService.listSubscriptionsAdmin({
      page: Number(page),
      limit: Number(limit),
      status: status as string,
      planType: plan_type as string,
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 *     responses:
 *       200:
 *         description: Revenue analytics retrieved successfully
 */
export const getRevenueAnalytics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { period = '30d', granularity = 'day' } = req.query;

    const analytics = await analyticsService.getRevenueAnalytics({
      period: period as string,
      granularity: granularity as string,
    });

    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 *     responses:
 *       200:
 *         description: Subscription analytics retrieved successfully
 */
export const getSubscriptionAnalytics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { period = '30d' } = req.query;

    const analytics = await analyticsService.getSubscriptionAnalytics({
      period: period as string,
    });

    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 *     responses:
 *       200:
 *         description: Failed payments retrieved successfully
 */
export const getFailedPayments = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await billingService.getFailedPayments({
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
export const retryFailedPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    await billingService.retryFailedPayment(id);

    logger.info('Failed payment retry initiated by admin', {
      failedPaymentId: id,
      adminUser: req.user?.email,
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      message: 'Payment retry initiated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 *             type: object
 *             required:
 *               - code
 *               - duration
 *             properties:
 *               code:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               name:
 *                 type: string
 *               percent_off:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100
 *               amount_off:
 *                 type: number
 *                 minimum: 0.01
 *               currency:
 *                 type: string
 *                 enum: [usd, eur, gbp, cad, aud, jpy]
 *               duration:
 *                 type: string
 *                 enum: [once, repeating, forever]
 *               duration_in_months:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 36
 *               max_redemptions:
 *                 type: integer
 *                 minimum: 1
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Promotional code created successfully
 */
export const createPromotionalCode = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const promoCode = await billingService.createPromotionalCode(req.body);

    logger.info('Promotional code created by admin', {
      promoCodeId: promoCode.id,
      code: promoCode.code,
      adminUser: req.user?.email,
      requestId: (req as any).requestId,
    });

    res.status(201).json({
      success: true,
      data: promoCode,
      message: 'Promotional code created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
export const getPromotionalCodes = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page = 1, limit = 20, active_only = false } = req.query;

    const result = await billingService.listPromotionalCodes({
      page: Number(page),
      limit: Number(limit),
      activeOnly: active_only === 'true',
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 */
export const getSystemHealth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const healthStatus = await billingService.getSystemHealth();

    res.json({
      success: true,
      data: healthStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 *           enum: [csv, xlsx]
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
 *     responses:
 *       200:
 *         description: Export initiated successfully
 */
export const exportCustomers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { format = 'csv', start_date, end_date } = req.query;

    const exportResult = await billingService.exportCustomers({
      format: format as string,
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
    });

    logger.info('Customer export initiated by admin', {
      format,
      adminUser: req.user?.email,
      requestId: (req as any).requestId,
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
};
