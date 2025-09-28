import request from 'supertest';
import { app } from '../../src/server';
import { setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../setup/dbSetup';

describe('Subscription Flow E2E Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should complete subscription lifecycle', async () => {
    const apiKey = 'sk_test_valid_key';

    // 1. Create customer
    const customerResponse = await request(app)
      .post('/api/billing/customers')
      .set('x-api-key', apiKey)
      .send({
        email: 'subscription-test@example.com',
        name: 'Subscription Test Customer',
      });

    const customerId = customerResponse.body.data.id;

    // 2. Get available plans
    const plansResponse = await request(app)
      .get('/api/billing/plans')
      .set('x-api-key', apiKey)
      .expect(200);

    const premiumPlan = plansResponse.body.data.find((p) => p.plan_type === 'premium');
    expect(premiumPlan).toBeDefined();

    // 3. Create subscription
    const subscriptionResponse = await request(app)
      .post('/api/billing/subscribe')
      .set('x-api-key', apiKey)
      .send({
        customer_id: customerId,
        plan_id: premiumPlan.id,
        trial_days: 14,
      })
      .expect(201);

    const subscriptionId = subscriptionResponse.body.data.id;
    expect(subscriptionId).toBeDefined();

    // 4. Get subscription
    const getSubResponse = await request(app)
      .get(`/api/billing/subscription/${subscriptionId}`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(getSubResponse.body.data.status).toBe('trialing');

    // 5. Record usage
    await request(app)
      .post('/api/billing/usage')
      .set('x-api-key', apiKey)
      .send({
        customer_id: customerId,
        metric_name: 'api_calls',
        quantity: 100,
      })
      .expect(200);

    // 6. Check usage stats
    const usageResponse = await request(app)
      .get(`/api/billing/usage/${customerId}`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(usageResponse.body.data.current_period_usage).toBe(100);

    // 7. Update subscription
    const updateResponse = await request(app)
      .put(`/api/billing/subscription/${subscriptionId}`)
      .set('x-api-key', apiKey)
      .send({
        quantity: 2,
        prorate: true,
      })
      .expect(200);

    expect(updateResponse.body.data.quantity).toBe(2);

    // 8. Cancel subscription
    const cancelResponse = await request(app)
      .delete(`/api/billing/subscription/${subscriptionId}`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(cancelResponse.body.data.cancel_at_period_end).toBe(true);
  });
});
