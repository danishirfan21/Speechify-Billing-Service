import { stripeService } from '../../../src/services/stripe.service';
import { mockStripeCustomer } from '../../mocks/stripe.mock';

// Mock Stripe
jest.mock('stripe');

describe('Stripe Customer Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCustomer', () => {
    it('should create customer in Stripe', async () => {
      // Arrange
      const customerData = {
        email: 'test@example.com',
        name: 'Test Customer',
      };

      // Mock Stripe response
      const mockCreate = jest.fn().mockResolvedValue(mockStripeCustomer);
      (stripeService as any).stripe = {
        customers: { create: mockCreate },
      };

      // Act
      const result = await stripeService.createCustomer(customerData);

      // Assert
      expect(mockCreate).toHaveBeenCalledWith({
        email: customerData.email,
        name: customerData.name,
        phone: undefined,
        address: undefined,
        tax_id_data: undefined,
        metadata: { company: '' },
      });
      expect(result).toEqual(mockStripeCustomer);
    });
  });
});
