import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging noise in tests

// Global test timeout
jest.setTimeout(30000);

// Mock external services by default
jest.mock('../src/services/stripe.service');
jest.mock('../src/services/email.service');
