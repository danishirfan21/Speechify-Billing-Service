import { billingService } from '../../../src/services/billing.service';
import { setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../../setup/dbSetup';
import { mockStripeService, mockStripeCustomer } from '../../mocks/stripe.mock';

// Mock the stripe service
jest.mock('../../../src/services/stripe.service', () => ({
  stripeService: mockStripeService,
}));

describe('BillingService', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    jest.clearAllMocks();
  });

  describe('createCustomer', () => {
    it('should create a customer successfully', async () => {
      // Arrange
      const customerData = {
        email: 'test@example.com',
        name: 'Test Customer',
      };

      mockStripeService.createCustomer.mockResolvedValue(mockStripeCustomer);

      // Act
      const result = await billingService.createCustomer(customerData);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(customerData.email);
      expect(result.stripe_customer_id).toBe(mockStripeCustomer.id);
      expect(mockStripeService.createCustomer).toHaveBeenCalledWith(customerData);
    });

    it('should throw error if customer already exists', async () => {
      // Arrange
      const customerData = {
        email: 'test@example.com',
        name: 'Test Customer',
      };

      // Create customer first
      mockStripeService.createCustomer.mockResolvedValue(mockStripeCustomer);
      await billingService.createCustomer(customerData);

      // Act & Assert
      await expect(billingService.createCustomer(customerData)).rejects.toThrow(
        'Customer with this email already exists',
      );
    });
  });

  describe('getCustomer', () => {
    it('should return customer if found', async () => {
      // Arrange
      const customerData = {
        email: 'test@example.com',
        name: 'Test Customer',
      };

      mockStripeService.createCustomer.mockResolvedValue(mockStripeCustomer);
      const createdCustomer = await billingService.createCustomer(customerData);

      // Act
      const result = await billingService.getCustomer(createdCustomer.id);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(createdCustomer.id);
    });

    it('should return null if customer not found', async () => {
      // Act
      const result = await billingService.getCustomer('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });
  });
});
