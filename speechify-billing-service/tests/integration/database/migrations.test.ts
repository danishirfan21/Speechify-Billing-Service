import { getDatabase } from '../../../src/database/connection';
import { setupTestDatabase, teardownTestDatabase } from '../../setup/dbSetup';

describe('Database Migrations', () => {
  let db: any;

  beforeAll(async () => {
    await setupTestDatabase();
    db = getDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('should create all required tables', async () => {
    const tables = [
      'customers',
      'subscription_plans',
      'subscriptions',
      'payment_methods',
      'invoices',
      'usage_records',
      'webhook_events',
      'failed_payments',
      'promotional_codes',
    ];

    for (const table of tables) {
      const exists = await db.schema.hasTable(table);
      expect(exists).toBe(true);
    }
  });

  it('should have correct indexes', async () => {
    // Check some critical indexes exist
    const customerEmailIndex = await db.raw(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'customers' AND indexname LIKE '%email%'
    `);
    expect(customerEmailIndex.rows.length).toBeGreaterThan(0);

    const subscriptionCustomerIndex = await db.raw(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'subscriptions' AND indexname LIKE '%customer_id%'
    `);
    expect(subscriptionCustomerIndex.rows.length).toBeGreaterThan(0);
  });
});
