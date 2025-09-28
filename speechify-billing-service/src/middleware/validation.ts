import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const validationErrors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      logger.warn('Validation failed', {
        path: req.path,
        method: req.method,
        errors: validationErrors,
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validationErrors,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const validationErrors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      logger.warn('Query validation failed', {
        path: req.path,
        method: req.method,
        errors: validationErrors,
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query validation failed',
          details: validationErrors,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Replace req.query with validated and sanitized data
    req.query = value;
    next();
  };
};
