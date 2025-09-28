import { getDatabase, initializeDatabase, closeDatabase } from '../../src/database/connection';
import { Knex } from 'knex';

let db: Knex;

export async function setupTestDatabase(): Promise<void> {
  db = await initializeDatabase();

  // Run migrations
  await db.migrate.latest();

  // Clear all tables
  await cleanDatabase();
}

export async function cleanDatabase(): Promise<void> {
  if (!db) return;

  // Disable foreign key checks temporarily
  await db.raw('SET session_replication_role = replica;');

  const tables = [
    'webhook_events',
    'failed_payments',
    'usage_records',
    'invoices',
    'payment_methods',
    'subscriptions',
    'customers',
    'subscription_plans',
    'promotional_codes',
  ];

  for (const table of tables) {
    await db(table).del();
  }

  // Re-enable foreign key checks
  await db.raw('SET session_replication_role = DEFAULT;');
}

export async function teardownTestDatabase(): Promise<void> {
  if (db) {
    await closeDatabase();
  }
}

export { db as testDb };
