import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailTemplateData {
  [key: string]: any;
}

interface WelcomeEmailData {
  customerName: string;
  subscriptionId: string;
}

interface PaymentSuccessEmailData {
  customerName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  paidAt: Date;
  invoiceUrl?: string;
}

interface PaymentFailedEmailData {
  customerName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: Date;
  invoiceUrl?: string;
}

interface TrialEndingEmailData {
  customerName: string;
  trialEndDate: Date;
  subscriptionId: string;
}

interface SubscriptionCanceledEmailData {
  customerName: string;
  subscriptionId: string;
  canceledAt: Date;
}

interface TrialConvertedEmailData {
  customerName: string;
  subscriptionId: string;
}

interface UpcomingInvoiceEmailData {
  customerName: string;
  amount: number;
  currency: string;
  dueDate: Date;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendWelcomeEmail(to: string, data: WelcomeEmailData): Promise<void> {
    const subject = 'Welcome to Speechify! Your subscription is active';
    const html = this.generateWelcomeEmailTemplate(data);

    await this.sendEmail(to, subject, html);
    logger.info(`Welcome email sent to ${to}`);
  }

  async sendPaymentSuccessEmail(to: string, data: PaymentSuccessEmailData): Promise<void> {
    const subject = `Payment Confirmation - Invoice ${data.invoiceNumber}`;
    const html = this.generatePaymentSuccessTemplate(data);

    await this.sendEmail(to, subject, html);
    logger.info(`Payment success email sent to ${to}`);
  }

  async sendPaymentFailedEmail(to: string, data: PaymentFailedEmailData): Promise<void> {
    const subject = `Payment Failed - Action Required for Invoice ${data.invoiceNumber}`;
    const html = this.generatePaymentFailedTemplate(data);

    await this.sendEmail(to, subject, html);
    logger.info(`Payment failed email sent to ${to}`);
  }

  async sendTrialEndingEmail(to: string, data: TrialEndingEmailData): Promise<void> {
    const subject = 'Your trial is ending soon - Add payment method to continue';
    const html = this.generateTrialEndingTemplate(data);

    await this.sendEmail(to, subject, html);
    logger.info(`Trial ending email sent to ${to}`);
  }

  async sendSubscriptionCanceledEmail(
    to: string,
    data: SubscriptionCanceledEmailData,
  ): Promise<void> {
    const subject = "Subscription Canceled - We're sorry to see you go";
    const html = this.generateSubscriptionCanceledTemplate(data);

    await this.sendEmail(to, subject, html);
    logger.info(`Subscription canceled email sent to ${to}`);
  }

  async sendTrialConvertedEmail(to: string, data: TrialConvertedEmailData): Promise<void> {
    const subject = 'Trial converted to paid subscription - Thank you!';
    const html = this.generateTrialConvertedTemplate(data);

    await this.sendEmail(to, subject, html);
    logger.info(`Trial converted email sent to ${to}`);
  }

  async sendUpcomingInvoiceEmail(to: string, data: UpcomingInvoiceEmailData): Promise<void> {
    const subject = 'Upcoming payment notification';
    const html = this.generateUpcomingInvoiceTemplate(data);

    await this.sendEmail(to, subject, html);
    logger.info(`Upcoming invoice email sent to ${to}`);
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.FROM_EMAIL || 'billing@speechify.com',
        to,
        subject,
        html,
      });

      logger.info(`Email sent: ${info.messageId}`);
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  // Email Templates
  private generateWelcomeEmailTemplate(data: WelcomeEmailData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Speechify</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Speechify!</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.customerName},</h2>
            <p>Thank you for subscribing to Speechify! Your subscription is now active and you can start enjoying all our premium features.</p>
            
            <p><strong>Subscription ID:</strong> ${data.subscriptionId}</p>
            
            <p>Here's what you can do next:</p>
            <ul>
              <li>Access your dashboard to manage your account</li>
              <li>Explore our API documentation</li>
              <li>Contact support if you have any questions</li>
            </ul>
            
            <a href="https://dashboard.speechify.com" class="button">Go to Dashboard</a>
            
            <p>If you have any questions, feel free to reach out to our support team.</p>
            
            <p>Welcome aboard!</p>
            <p>The Speechify Team</p>
          </div>
          <div class="footer">
            <p>Speechify | billing@speechify.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePaymentSuccessTemplate(data: PaymentSuccessEmailData): string {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.currency.toUpperCase(),
    }).format(data.amount);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; }
          .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .payment-details { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Confirmation</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.customerName},</h2>
            <p>We've successfully received your payment. Thank you for your continued subscription to Speechify!</p>
            
            <div class="payment-details">
              <h3>Payment Details</h3>
              <p><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
              <p><strong>Amount Paid:</strong> ${formattedAmount}</p>
              <p><strong>Payment Date:</strong> ${data.paidAt.toLocaleDateString()}</p>
            </div>
            
            ${data.invoiceUrl ? `<a href="${data.invoiceUrl}" class="button">View Invoice</a>` : ''}
            
            <p>Your subscription remains active and you can continue using all Speechify features.</p>
            
            <p>Thank you for your business!</p>
            <p>The Speechify Billing Team</p>
          </div>
          <div class="footer">
            <p>Speechify | billing@speechify.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePaymentFailedTemplate(data: PaymentFailedEmailData): string {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.currency.toUpperCase(),
    }).format(data.amount);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Failed - Action Required</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; }
          .header { background-color: #EF4444; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .payment-details { background-color: #fef2f2; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #EF4444; }
          .button { display: inline-block; background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Failed - Action Required</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.customerName},</h2>
            <p>We were unable to process your payment for your Speechify subscription. To avoid any service interruption, please update your payment method as soon as possible.</p>
            
            <div class="payment-details">
              <h3>Failed Payment Details</h3>
              <p><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
              <p><strong>Amount Due:</strong> ${formattedAmount}</p>
              <p><strong>Due Date:</strong> ${data.dueDate.toLocaleDateString()}</p>
            </div>
            
            <p>What happens next:</p>
            <ul>
              <li>We'll retry the payment automatically in a few days</li>
              <li>If payment continues to fail, your service may be suspended</li>
              <li>You can update your payment method anytime in your dashboard</li>
            </ul>
            
            <a href="https://dashboard.speechify.com/billing" class="button">Update Payment Method</a>
            
            ${data.invoiceUrl ? `<p><a href="${data.invoiceUrl}">View Invoice</a></p>` : ''}
            
            <p>If you have any questions or need assistance, please contact our support team.</p>
            
            <p>The Speechify Billing Team</p>
          </div>
          <div class="footer">
            <p>Speechify | billing@speechify.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateTrialEndingTemplate(data: TrialEndingEmailData): string {
    const daysLeft = Math.ceil((data.trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your trial is ending soon</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; }
          .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .trial-info { background-color: #fffbeb; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #F59E0B; }
          .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your trial is ending soon</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.customerName},</h2>
            <p>Your free trial of Speechify is ending in ${daysLeft} day${
      daysLeft !== 1 ? 's' : ''
    }. We hope you've enjoyed exploring our features!</p>
            
            <div class="trial-info">
              <h3>Trial Information</h3>
              <p><strong>Trial End Date:</strong> ${data.trialEndDate.toLocaleDateString()}</p>
              <p><strong>Subscription ID:</strong> ${data.subscriptionId}</p>
            </div>
            
            <p>To continue using Speechify without interruption, please add a payment method to your account before your trial expires.</p>
            
            <p>What you'll get with a paid subscription:</p>
            <ul>
              <li>Unlimited API calls</li>
              <li>Premium voice options</li>
              <li>Priority support</li>
              <li>Advanced analytics</li>
            </ul>
            
            <a href="https://dashboard.speechify.com/billing" class="button">Add Payment Method</a>
            
            <p>Questions? Our support team is here to help!</p>
            
            <p>The Speechify Team</p>
          </div>
          <div class="footer">
            <p>Speechify | billing@speechify.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateSubscriptionCanceledTemplate(data: SubscriptionCanceledEmailData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Canceled</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; }
          .header { background-color: #6B7280; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .cancellation-info { background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Canceled</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.customerName},</h2>
            <p>We're sorry to see you go. Your Speechify subscription has been successfully canceled.</p>
            
            <div class="cancellation-info">
              <h3>Cancellation Details</h3>
              <p><strong>Subscription ID:</strong> ${data.subscriptionId}</p>
              <p><strong>Canceled Date:</strong> ${data.canceledAt.toLocaleDateString()}</p>
            </div>
            
            <p>What happens now:</p>
            <ul>
              <li>You'll continue to have access until the end of your current billing period</li>
              <li>No further charges will be made to your account</li>
              <li>Your data will be retained for 30 days in case you change your mind</li>
            </ul>
            
            <p>We'd love to have you back anytime. If you have any feedback about why you canceled, we'd appreciate hearing from you.</p>
            
            <a href="https://dashboard.speechify.com/reactivate" class="button">Reactivate Subscription</a>
            
            <p>Thank you for being a valued customer.</p>
            
            <p>The Speechify Team</p>
          </div>
          <div class="footer">
            <p>Speechify | billing@speechify.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateTrialConvertedTemplate(data: TrialConvertedEmailData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trial Converted - Welcome to Speechify Premium!</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; }
          .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .conversion-info { background-color: #ecfdf5; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10B981; }
          .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Speechify Premium!</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.customerName},</h2>
            <p>Congratulations! Your trial has been successfully converted to a paid subscription. You now have full access to all Speechify premium features.</p>
            
            <div class="conversion-info">
              <h3>Subscription Details</h3>
              <p><strong>Subscription ID:</strong> ${data.subscriptionId}</p>
              <p><strong>Status:</strong> Active</p>
            </div>
            
            <p>As a premium subscriber, you now enjoy:</p>
            <ul>
              <li>Unlimited API calls</li>
              <li>All premium voice options</li>
              <li>Priority customer support</li>
              <li>Advanced usage analytics</li>
              <li>Team collaboration features</li>
            </ul>
            
            <a href="https://dashboard.speechify.com" class="button">Access Your Dashboard</a>
            
            <p>Thank you for choosing Speechify Premium. We're excited to support your journey!</p>
            
            <p>The Speechify Team</p>
          </div>
          <div class="footer">
            <p>Speechify | billing@speechify.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateUpcomingInvoiceTemplate(data: UpcomingInvoiceEmailData): string {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.currency.toUpperCase(),
    }).format(data.amount);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Upcoming Payment Notification</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .invoice-info { background-color: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Upcoming Payment</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.customerName},</h2>
            <p>This is a friendly reminder that your next Speechify payment is coming up soon.</p>
            
            <div class="invoice-info">
              <h3>Payment Information</h3>
              <p><strong>Amount:</strong> ${formattedAmount}</p>
              <p><strong>Due Date:</strong> ${data.dueDate.toLocaleDateString()}</p>
            </div>
            
            <p>The payment will be automatically charged to your default payment method. Please ensure your payment information is up to date to avoid any service interruption.</p>
            
            <a href="https://dashboard.speechify.com/billing" class="button">Update Payment Method</a>
            
            <p>If you have any questions about your billing, please don't hesitate to contact our support team.</p>
            
            <p>Thank you for your continued subscription!</p>
            <p>The Speechify Billing Team</p>
          </div>
          <div class="footer">
            <p>Speechify | billing@speechify.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Test email connection
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
