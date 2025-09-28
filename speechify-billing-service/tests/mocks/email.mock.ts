export const mockEmailService = {
  sendWelcomeEmail: jest.fn(),
  sendPaymentSuccessEmail: jest.fn(),
  sendPaymentFailedEmail: jest.fn(),
  sendTrialEndingEmail: jest.fn(),
  sendSubscriptionCanceledEmail: jest.fn(),
  sendTrialConvertedEmail: jest.fn(),
  sendUpcomingInvoiceEmail: jest.fn(),
  testConnection: jest.fn().mockResolvedValue(true),
};
