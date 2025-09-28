import { TransportOptions } from 'nodemailer';

export const emailConfig: TransportOptions = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
};

export const emailDefaults = {
  from: process.env.FROM_EMAIL || 'billing@speechify.com',
  replyTo: process.env.REPLY_TO_EMAIL || 'support@speechify.com',
};

export const emailTemplates = {
  welcome: {
    subject: 'Welcome to Speechify! Your subscription is active',
    priority: 'normal' as const,
  },
  paymentSuccess: {
    subject: 'Payment Confirmation',
    priority: 'normal' as const,
  },
  paymentFailed: {
    subject: 'Payment Failed - Action Required',
    priority: 'high' as const,
  },
  trialEnding: {
    subject: 'Your trial is ending soon',
    priority: 'high' as const,
  },
  subscriptionCanceled: {
    subject: 'Subscription Canceled',
    priority: 'normal' as const,
  },
};
