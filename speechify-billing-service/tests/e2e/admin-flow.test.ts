import request from 'supertest';
import { app } from '../../src/server';
import { setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../setup/dbSetup';

describe('Admin Flow E2E Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  const adminAuth = Buffer.from('admin:admin123').toString('base64');

  it('should provide admin dashboard data', async () => {
    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Basic ${adminAuth}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.metrics).toBeDefined();
    expect(response.body.data.recent_activity).toBeDefined();
  });

  it('should list customers with pagination', async () => {
    const response = await request(app)
      .get('/api/admin/customers?page=1&limit=10')
      .set('Authorization', `Basic ${adminAuth}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.customers).toBeDefined();
    expect(response.body.data.pagination).toBeDefined();
  });

  it('should provide system health information', async () => {
    const response = await request(app)
      .get('/api/admin/system/health')
      .set('Authorization', `Basic ${adminAuth}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.overall_status).toBeDefined();
    expect(response.body.data.components).toBeDefined();
  });
});
