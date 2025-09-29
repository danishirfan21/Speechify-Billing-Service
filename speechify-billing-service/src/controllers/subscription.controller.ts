import { Request, Response, NextFunction } from 'express';
import { billingService } from '../services/billing.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * @swagger
 * tags:
 *   name: Subscriptions
 *   description: Subscription lifecycle management
 */

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
 *     responses:
 *       201:
 *         description: Subscription created successfully
 */
export const createSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const subscription = await billingService.createSubscription(req.body);

    logger.info('Subscription created successfully', {
      subscriptionId: subscription.id,
      customerId: req.body.customer_id,
      planId: req.body.plan_id,
      requestId: (req as any).requestId,
    });

    res.status(201).json({
      success: true,
      data: subscription,
      message: 'Subscription created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
export const getSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const subscription = await billingService.getSubscription(id);

    if (!subscription) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: subscription,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 */
export const updateSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const subscription = await billingService.updateSubscription(id, req.body);

    logger.info('Subscription updated successfully', {
      subscriptionId: id,
      changes: req.body,
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 *     responses:
 *       200:
 *         description: Subscription canceled successfully
 */
export const cancelSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { immediately = false } = req.query;
    
    const subscription = await billingService.cancelSubscription(id, immediately === 'true');

    logger.info('Subscription canceled successfully', {
      subscriptionId: id,
      immediately: immediately === 'true',
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      data: subscription,
      message: immediately === 'true' 
        ? 'Subscription canceled immediately' 
        : 'Subscription scheduled for cancellation at period end',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
export const pauseSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { resume_at } = req.body;
    
    const resumeDate = resume_at ? new Date(resume_at) : undefined;
    const subscription = await billingService.pauseSubscription(id, resumeDate);

    logger.info('Subscription paused successfully', {
      subscriptionId: id,
      resumeAt: resumeDate,
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription paused successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
export const resumeSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const subscription = await billingService.resumeSubscription(id);

    logger.info('Subscription resumed successfully', {
      subscriptionId: id,
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription resumed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
export const previewSubscriptionChange = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const preview = await billingService.previewSubscriptionChange(id, req.body);

    res.json({
      success: true,
      data: preview,
      message: 'Subscription change preview generated',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
export const getSubscriptionPlans = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { currency = 'usd' } = req.query;
    const plans = await billingService.getAllSubscriptionPlans(currency as string);

    res.json({
      success: true,
      data: plans,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 */
export const getUsageStats = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customerId } = req.params;
    const { period = 'current' } = req.query;
    
    const usageStats = await billingService.getUsageStats(customerId, period as string);

    res.json({
      success: true,
      data: usageStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

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
 *               metric_name:
 *                 type: string
 *                 enum: [api_calls, characters_processed, voice_minutes, storage_mb]
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 1000000
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Usage recorded successfully
 */
export const recordUsage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customer_id, metric_name, quantity, metadata } = req.body;
    
    await billingService.recordUsage(customer_id, metric_name, quantity, metadata);

    logger.info('Usage recorded successfully', {
      customerId: customer_id,
      metricName: metric_name,
      quantity,
      requestId: (req as any).requestId,
    });

    res.json({
      success: true,
      message: 'Usage recorded successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};