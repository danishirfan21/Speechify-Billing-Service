import request from 'supertest';
import { app } from '../../src/server';
import { setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../setup/dbSetup';

describe('Customer Flow E2E Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should complete full customer lifecycle', async () => {
    const apiKey = 'sk_test_valid_key';

    // 1. Create customer
    const customerData = {
      email: 'e2e-test@example.com',
      name: 'E2E Test Customer',
      company: 'Test Company',
    };

    const createCustomerResponse = await request(app)
      .post('/api/billing/customers')
      .set('x-api-key', apiKey)
      .send(customerData)
      .expect(201);

    const customerId = createCustomerResponse.body.data.id;
    expect(customerId).toBeDefined();

    // 2. Get customer
    const getCustomerResponse = await request(app)
      .get(`/api/billing/customers/${customerId}`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(getCustomerResponse.body.data.email).toBe(customerData.email);

    // 3. Update customer
    const updateData = {
      name: 'Updated E2E Customer',
      company: 'Updated Company',
    };

    const updateCustomerResponse = await request(app)
      .put(`/api/billing/customers/${customerId}`)
      .set('x-api-key', apiKey)
      .send(updateData)
      .expect(200);

    expect(updateCustomerResponse.body.data.name).toBe(updateData.name);

    // 4. Get usage stats (should be empty initially)
    const usageResponse = await request(app)
      .get(`/api/billing/usage/${customerId}`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(usageResponse.body.data.current_period_usage).toBe(0);
  });
});
