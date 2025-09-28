import request from 'supertest';
import { app } from '../../../src/server';
import { setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../../setup/dbSetup';

describe('Billing API Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/billing/customers', () => {
    it('should create a customer', async () => {
      const customerData = {
        email: 'test@example.com',
        name: 'Test Customer',
      };

      const response = await request(app)
        .post('/api/billing/customers')
        .set('x-api-key', 'sk_test_valid_key')
        .send(customerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(customerData.email);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/billing/customers')
        .set('x-api-key', 'sk_test_valid_key')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/billing/customers/:id', () => {
    it('should get customer by id', async () => {
      // First create a customer
      const customerData = {
        email: 'test@example.com',
        name: 'Test Customer',
      };

      const createResponse = await request(app)
        .post('/api/billing/customers')
        .set('x-api-key', 'sk_test_valid_key')
        .send(customerData);

      const customerId = createResponse.body.data.id;

      // Then get the customer
      const response = await request(app)
        .get(`/api/billing/customers/${customerId}`)
        .set('x-api-key', 'sk_test_valid_key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(customerId);
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await request(app)
        .get('/api/billing/customers/non-existent-id')
        .set('x-api-key', 'sk_test_valid_key')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
