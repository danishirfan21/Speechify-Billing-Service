import request from 'supertest';
import { app } from '../../src/server';
import { setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../setup/dbSetup';

describe('Payment Flow E2E Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should handle payment method management', async () => {
    const apiKey = 'sk_test_valid_key';

    // 1. Create customer
    const customerResponse = await request(app)
      .post('/api/billing/customers')
      .set('x-api-key', apiKey)
      .send({
        email: 'payment-test@example.com',
        name: 'Payment Test Customer',
      });

    const customerId = customerResponse.body.data.id;

    // 2. Attach payment method
    const attachResponse = await request(app)
      .post('/api/billing/payment-methods/attach')
      .set('x-api-key', apiKey)
      .send({
        customer_id: customerId,
        payment_method_id: 'pm_test_card',
      })
      .expect(200);

    expect(attachResponse.body.success).toBe(true);

    // 3. Get customer payment methods
    const methodsResponse = await request(app)
      .get(`/api/billing/customers/${customerId}/payment-methods`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(Array.isArray(methodsResponse.body.data)).toBe(true);

    // 4. Get customer invoices
    const invoicesResponse = await request(app)
      .get(`/api/billing/customers/${customerId}/invoices`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(Array.isArray(invoicesResponse.body.data)).toBe(true);
  });
});
