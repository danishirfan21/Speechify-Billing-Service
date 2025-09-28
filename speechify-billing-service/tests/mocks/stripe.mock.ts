export const mockStripeService = {
  createCustomer: jest.fn(),
  updateCustomer: jest.fn(),
  getCustomer: jest.fn(),
  deleteCustomer: jest.fn(),
  createSubscription: jest.fn(),
  updateSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  getSubscription: jest.fn(),
  attachPaymentMethod: jest.fn(),
  detachPaymentMethod: jest.fn(),
  listPaymentMethods: jest.fn(),
  constructEvent: jest.fn(),
  testConnection: jest.fn().mockResolvedValue(true),
};

// Mock customer data
export const mockStripeCustomer = {
  id: 'cus_test123',
  email: 'test@example.com',
  name: 'Test Customer',
  created: Math.floor(Date.now() / 1000),
  metadata: {},
};

// Mock subscription data
export const mockStripeSubscription = {
  id: 'sub_test123',
  customer: 'cus_test123',
  status: 'active',
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
  items: {
    data: [
      {
        id: 'si_test123',
        price: {
          id: 'price_test123',
          unit_amount: 999,
          currency: 'usd',
        },
      },
    ],
  },
};
