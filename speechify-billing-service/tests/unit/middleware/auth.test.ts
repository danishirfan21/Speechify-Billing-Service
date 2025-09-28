import { Request, Response, NextFunction } from 'express';
import { authenticateApiKey } from '../../../src/middleware/auth';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('authenticateApiKey', () => {
    it('should authenticate valid API key', async () => {
      // Arrange
      mockRequest.headers = {
        'x-api-key': 'sk_test_valid_key',
      };

      // Act
      await authenticateApiKey(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject request without API key', async () => {
      // Act
      await authenticateApiKey(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'API key required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid API key', async () => {
      // Arrange
      mockRequest.headers = {
        'x-api-key': 'invalid_key',
      };

      // Act
      await authenticateApiKey(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid API key',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
