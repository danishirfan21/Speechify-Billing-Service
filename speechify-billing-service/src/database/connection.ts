import knex, { Knex } from 'knex';
import knexConfig from '../../knexfile';
import { logger } from '../utils/logger';

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

let db: Knex;

export const initializeDatabase = async (): Promise<Knex> => {
  try {
    db = knex(config);

    // Test the connection
    await db.raw('SELECT 1');
    logger.info(`Database connected successfully in ${environment} mode`);

    return db;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

export const getDatabase = (): Knex => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
};

export const closeDatabase = async (): Promise<void> => {
  if (db) {
    await db.destroy();
    logger.info('Database connection closed');
  }
};

// Health check function
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};

export { db };
