import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/connection';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    customerId?: string;
  };
  apiKey?: {
    id: string;
    name: string;
    customerId: string;
  };
}

// API Key authentication for external API access
export const authenticateApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        message: 'API key required',
      });
      return;
    }

    // In a real implementation, you'd validate the API key against your database
    // For demo purposes, we'll use a simple validation
    if (apiKey !== process.env.API_KEY && !apiKey.startsWith('sk_test_')) {
      res.status(401).json({
        success: false,
        message: 'Invalid API key',
      });
      return;
    }

    // You would typically fetch customer info associated with the API key
    req.apiKey = {
      id: 'api_key_123',
      name: 'Demo API Key',
      customerId: 'customer_123',
    };

    next();
  } catch (error) {
    logger.error('API key authentication failed:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

// JWT authentication for web dashboard
export const authenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required',
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as any;

    // Fetch user details from database
    const db = getDatabase();
    const user = await db('customers')
      .where('id', decoded.customerId)
      .whereNull('deleted_at')
      .first();

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid token - user not found',
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      customerId: user.id,
    };

    next();
  } catch (error) {
    logger.error('JWT authentication failed:', error);

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token expired',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Authentication error',
      });
    }
  }
};

// Admin authentication for admin dashboard
export const authenticateAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.status(401).json({
        success: false,
        message: 'Basic authentication required',
      });
      return;
    }

    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username !== adminUsername || password !== adminPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid admin credentials',
      });
      return;
    }

    req.user = {
      id: 'admin',
      email: 'admin@speechify.com',
    };

    next();
  } catch (error) {
    logger.error('Admin authentication failed:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

// Generate JWT token
export const generateToken = (customerId: string, email: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign({ customerId, email }, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'speechify-billing',
  });
};

// Generate refresh token
export const generateRefreshToken = (customerId: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign({ customerId, type: 'refresh' }, jwtSecret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    issuer: 'speechify-billing',
  });
};

// Verify refresh token
export const verifyRefreshToken = (token: string): { customerId: string } => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const decoded = jwt.verify(token, jwtSecret) as any;

  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return { customerId: decoded.customerId };
};

export type { AuthenticatedRequest };
