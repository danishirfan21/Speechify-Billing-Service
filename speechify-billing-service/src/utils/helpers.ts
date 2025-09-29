import { Currency } from '../types';

// Format currency
export const formatCurrency = (amount: number, currency: Currency = 'usd'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
};

// Format date
export const formatDate = (date: Date | string, format: 'short' | 'long' = 'short'): string => {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (format === 'long') {
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return d.toLocaleDateString('en-US');
};

// Calculate percentage
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 100) / 100;
};

// Calculate growth rate
export const calculateGrowthRate = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 100) / 100;
};

// Parse period string to days
export const parsePeriodToDays = (period: string): number => {
  const periodMap: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
  };
  return periodMap[period] || 30;
};

// Generate random string
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Delay/sleep function
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Retry function with exponential backoff
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> => {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delayTime = baseDelay * Math.pow(2, i);
        await delay(delayTime);
      }
    }
  }

  throw lastError!;
};

// Chunk array
export const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// Deep clone object
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

// Truncate string
export const truncate = (str: string, length: number): string => {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
};

// Calculate MRR from subscription data
export const calculateMRR = (amount: number, interval: 'month' | 'year', quantity = 1): number => {
  const monthlyAmount = interval === 'year' ? amount / 12 : amount;
  return monthlyAmount * quantity;
};

// Calculate ARR from MRR
export const calculateARR = (mrr: number): number => {
  return mrr * 12;
};

// Validate email
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate UUID
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Calculate days between dates
export const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
};

// Get date range for period
export const getDateRangeForPeriod = (period: string): { start: Date; end: Date } => {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }

  return { start, end };
};

// Format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

// Sanitize filename
export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
};

// Calculate LTV (Lifetime Value)
export const calculateLTV = (
  averageMonthlyRevenue: number,
  averageLifetimeMonths: number,
): number => {
  return averageMonthlyRevenue * averageLifetimeMonths;
};

// Calculate churn rate
export const calculateChurnRate = (
  churnedCustomers: number,
  totalCustomersAtStart: number,
): number => {
  if (totalCustomersAtStart === 0) return 0;
  return (churnedCustomers / totalCustomersAtStart) * 100;
};

export default {
  formatCurrency,
  formatDate,
  calculatePercentage,
  calculateGrowthRate,
  parsePeriodToDays,
  generateRandomString,
  delay,
  retryWithBackoff,
  chunkArray,
  deepClone,
  truncate,
  calculateMRR,
  calculateARR,
  isValidEmail,
  isValidUUID,
  daysBetween,
  getDateRangeForPeriod,
  formatFileSize,
  sanitizeFilename,
  calculateLTV,
  calculateChurnRate,
};
