import { Knex } from 'knex';
import knexConfig from '../../knexfile';

const environment = process.env.NODE_ENV || 'development';

export const databaseConfig: Knex.Config = knexConfig[environment];

export const connectionConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'speechify_billing',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

export const poolConfig = {
  min: process.env.NODE_ENV === 'production' ? 2 : 1,
  max: process.env.NODE_ENV === 'production' ? 20 : 10,
  createTimeoutMillis: 3000,
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 100,
};
