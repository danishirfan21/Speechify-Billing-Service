import { Currency, PlanType } from '../types';

// Email validation
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    return { valid: false, error: 'Email is required' };
  }

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (email.length > 255) {
    return { valid: false, error: 'Email is too long' };
  }

  return { valid: true };
};

// Phone number validation
export const validatePhoneNumber = (phone: string): { valid: boolean; error?: string } => {
  const phoneRegex = /^\+?[\d\s-()]+$/;

  if (!phone) {
    return { valid: true }; // Phone is optional
  }

  if (!phoneRegex.test(phone)) {
    return { valid: false, error: 'Invalid phone number format' };
  }

  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return { valid: false, error: 'Phone number must be between 10-15 digits' };
  }

  return { valid: true };
};

// Currency validation
export const validateCurrency = (currency: string): { valid: boolean; error?: string } => {
  const validCurrencies: Currency[] = ['usd', 'eur', 'gbp', 'cad', 'aud', 'jpy'];

  if (!currency) {
    return { valid: false, error: 'Currency is required' };
  }

  if (!validCurrencies.includes(currency.toLowerCase() as Currency)) {
    return {
      valid: false,
      error: `Currency must be one of: ${validCurrencies.join(', ')}`,
    };
  }

  return { valid: true };
};

// Amount validation
export const validateAmount = (
  amount: number,
  options: { min?: number; max?: number } = {},
): { valid: boolean; error?: string } => {
  const { min = 0, max = 999999.99 } = options;

  if (amount === undefined || amount === null) {
    return { valid: false, error: 'Amount is required' };
  }

  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }

  if (amount < min) {
    return { valid: false, error: `Amount must be at least ${min}` };
  }

  if (amount > max) {
    return { valid: false, error: `Amount cannot exceed ${max}` };
  }

  // Check for reasonable decimal places
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    return { valid: false, error: 'Amount cannot have more than 2 decimal places' };
  }

  return { valid: true };
};

// UUID validation
export const validateUUID = (uuid: string): { valid: boolean; error?: string } => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuid) {
    return { valid: false, error: 'ID is required' };
  }

  if (!uuidRegex.test(uuid)) {
    return { valid: false, error: 'Invalid ID format' };
  }

  return { valid: true };
};

// Plan type validation
export const validatePlanType = (planType: string): { valid: boolean; error?: string } => {
  const validTypes: PlanType[] = ['free', 'premium', 'pro'];

  if (!planType) {
    return { valid: false, error: 'Plan type is required' };
  }

  if (!validTypes.includes(planType as PlanType)) {
    return {
      valid: false,
      error: `Plan type must be one of: ${validTypes.join(', ')}`,
    };
  }

  return { valid: true };
};

// Date validation
export const validateDate = (
  date: string | Date,
  options: { future?: boolean; past?: boolean } = {},
): { valid: boolean; error?: string } => {
  if (!date) {
    return { valid: false, error: 'Date is required' };
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  const now = new Date();

  if (options.future && dateObj <= now) {
    return { valid: false, error: 'Date must be in the future' };
  }

  if (options.past && dateObj >= now) {
    return { valid: false, error: 'Date must be in the past' };
  }

  return { valid: true };
};

// Promo code validation
export const validatePromoCode = (code: string): { valid: boolean; error?: string } => {
  if (!code) {
    return { valid: true }; // Promo code is optional
  }

  const promoRegex = /^[A-Z0-9]{3,50}$/;

  if (!promoRegex.test(code)) {
    return {
      valid: false,
      error: 'Promo code must be 3-50 uppercase alphanumeric characters',
    };
  }

  return { valid: true };
};

// Quantity validation
export const validateQuantity = (
  quantity: number,
  options: { min?: number; max?: number } = {},
): { valid: boolean; error?: string } => {
  const { min = 1, max = 1000 } = options;

  if (quantity === undefined || quantity === null) {
    return { valid: false, error: 'Quantity is required' };
  }

  if (!Number.isInteger(quantity)) {
    return { valid: false, error: 'Quantity must be a whole number' };
  }

  if (quantity < min) {
    return { valid: false, error: `Quantity must be at least ${min}` };
  }

  if (quantity > max) {
    return { valid: false, error: `Quantity cannot exceed ${max}` };
  }

  return { valid: true };
};

// Country code validation (ISO 3166-1 alpha-2)
export const validateCountryCode = (code: string): { valid: boolean; error?: string } => {
  if (!code) {
    return { valid: true }; // Country code is optional
  }

  if (code.length !== 2) {
    return { valid: false, error: 'Country code must be 2 characters (ISO 3166-1 alpha-2)' };
  }

  if (!/^[A-Z]{2}$/.test(code.toUpperCase())) {
    return { valid: false, error: 'Country code must contain only letters' };
  }

  return { valid: true };
};

// Postal code validation
export const validatePostalCode = (
  postalCode: string,
  countryCode?: string,
): { valid: boolean; error?: string } => {
  if (!postalCode) {
    return { valid: true }; // Postal code is optional
  }

  if (postalCode.length > 20) {
    return { valid: false, error: 'Postal code is too long' };
  }

  // Country-specific validation
  if (countryCode) {
    switch (countryCode.toUpperCase()) {
      case 'US':
        if (!/^\d{5}(-\d{4})?$/.test(postalCode)) {
          return { valid: false, error: 'Invalid US postal code format (12345 or 12345-6789)' };
        }
        break;
      case 'CA':
        if (!/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i.test(postalCode)) {
          return { valid: false, error: 'Invalid Canadian postal code format (A1A 1A1)' };
        }
        break;
      case 'GB':
        if (!/^[A-Z]{1,2}\d{1,2}[A-Z]? ?\d[A-Z]{2}$/i.test(postalCode)) {
          return { valid: false, error: 'Invalid UK postal code format' };
        }
        break;
    }
  }

  return { valid: true };
};

// Tax ID validation
export const validateTaxId = (taxId: string): { valid: boolean; error?: string } => {
  if (!taxId) {
    return { valid: true }; // Tax ID is optional
  }

  if (taxId.length > 100) {
    return { valid: false, error: 'Tax ID is too long' };
  }

  // Basic alphanumeric validation
  if (!/^[A-Z0-9-]+$/i.test(taxId)) {
    return { valid: false, error: 'Tax ID contains invalid characters' };
  }

  return { valid: true };
};

// Billing interval validation
export const validateBillingInterval = (interval: string): { valid: boolean; error?: string } => {
  const validIntervals = ['month', 'year'];

  if (!interval) {
    return { valid: false, error: 'Billing interval is required' };
  }

  if (!validIntervals.includes(interval.toLowerCase())) {
    return {
      valid: false,
      error: `Billing interval must be one of: ${validIntervals.join(', ')}`,
    };
  }

  return { valid: true };
};

// Metadata validation
export const validateMetadata = (metadata: Record<string, unknown>): { valid: boolean; error?: string } => {
  if (!metadata) {
    return { valid: true }; // Metadata is optional
  }

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { valid: false, error: 'Metadata must be an object' };
  }

  // Check metadata size
  const metadataString = JSON.stringify(metadata);
  if (metadataString.length > 5000) {
    return { valid: false, error: 'Metadata is too large (max 5000 characters)' };
  }

  // Check for valid keys and values
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof key !== 'string' || key.length > 40) {
      return { valid: false, error: 'Metadata keys must be strings with max 40 characters' };
    }

    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      return { valid: false, error: 'Metadata values must be strings, numbers, or booleans' };
    }
  }

  return { valid: true };
};

// Percentage validation
export const validatePercentage = (
  percentage: number,
  options: { min?: number; max?: number } = {},
): { valid: boolean; error?: string } => {
  const { min = 0, max = 100 } = options;

  if (percentage === undefined || percentage === null) {
    return { valid: false, error: 'Percentage is required' };
  }

  if (typeof percentage !== 'number' || isNaN(percentage)) {
    return { valid: false, error: 'Percentage must be a valid number' };
  }

  if (percentage < min || percentage > max) {
    return { valid: false, error: `Percentage must be between ${min} and ${max}` };
  }

  return { valid: true };
};

// Trial days validation
export const validateTrialDays = (days: number): { valid: boolean; error?: string } => {
  if (days === undefined || days === null) {
    return { valid: true }; // Trial days is optional
  }

  if (!Number.isInteger(days)) {
    return { valid: false, error: 'Trial days must be a whole number' };
  }

  if (days < 0 || days > 365) {
    return { valid: false, error: 'Trial days must be between 0 and 365' };
  }

  return { valid: true };
};

// Composite validator for customer data
export const validateCustomerData = (data: Record<string, unknown>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  const emailValidation = validateEmail(data.email);
  if (!emailValidation.valid) errors.push(emailValidation.error!);

  if (data.phone) {
    const phoneValidation = validatePhoneNumber(data.phone);
    if (!phoneValidation.valid) errors.push(phoneValidation.error!);
  }

  if (data.address?.country) {
    const countryValidation = validateCountryCode(data.address.country);
    if (!countryValidation.valid) errors.push(countryValidation.error!);
  }

  if (data.address?.postal_code && data.address?.country) {
    const postalValidation = validatePostalCode(data.address.postal_code, data.address.country);
    if (!postalValidation.valid) errors.push(postalValidation.error!);
  }

  if (data.tax_id) {
    const taxValidation = validateTaxId(data.tax_id);
    if (!taxValidation.valid) errors.push(taxValidation.error!);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export default {
  validateEmail,
  validatePhoneNumber,
  validateCurrency,
  validateAmount,
  validateUUID,
  validatePlanType,
  validateDate,
  validatePromoCode,
  validateQuantity,
  validateCountryCode,
  validatePostalCode,
  validateTaxId,
  validateBillingInterval,
  validateMetadata,
  validatePercentage,
  validateTrialDays,
  validateCustomerData,
};
