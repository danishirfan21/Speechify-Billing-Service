import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';

export async function seed(knex: Knex): Promise<void> {
  // Only run in development environment
  if (process.env.NODE_ENV !== 'development') {
    console.log('⏭️  Skipping sample data seed (not in development environment)');
    return;
  }

  // Clear existing sample data
  await knex('usage_records').del();
  await knex('invoices').del();
  await knex('payment_methods').del();
  await knex('subscriptions').del();
  await knex('customers').del();

  // Get subscription plans
  const plans = await knex('subscription_plans').select('*');
  const freePlan = plans.find((p) => p.plan_type === 'free');
  const premiumPlan = plans.find(
    (p) => p.plan_type === 'premium' && p.billing_interval === 'month',
  );
  const proPlan = plans.find((p) => p.plan_type === 'pro' && p.billing_interval === 'month');

  if (!freePlan || !premiumPlan || !proPlan) {
    throw new Error(
      'Required subscription plans not found. Please run subscription plans seed first.',
    );
  }

  // Sample customers
  const customers = [
    {
      id: uuidv4(),
      stripe_customer_id: 'cus_sample_001',
      email: 'john.doe@techcorp.com',
      name: 'John Doe',
      company: 'TechCorp Inc.',
      phone: '+1-555-123-4567',
      address_line1: '123 Tech Street',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94105',
      country: 'US',
      currency: 'usd',
      created_at: new Date('2024-01-15'),
      updated_at: new Date('2024-01-15'),
    },
    {
      id: uuidv4(),
      stripe_customer_id: 'cus_sample_002',
      email: 'sarah.wilson@startuplab.io',
      name: 'Sarah Wilson',
      company: 'StartupLab',
      phone: '+1-555-987-6543',
      address_line1: '456 Innovation Ave',
      city: 'Austin',
      state: 'TX',
      postal_code: '73301',
      country: 'US',
      currency: 'usd',
      created_at: new Date('2024-01-20'),
      updated_at: new Date('2024-01-20'),
    },
    {
      id: uuidv4(),
      stripe_customer_id: 'cus_sample_003',
      email: 'michael.chen@globaltech.com',
      name: 'Michael Chen',
      company: 'Global Tech Solutions',
      phone: '+1-555-456-7890',
      address_line1: '789 Business Blvd',
      city: 'New York',
      state: 'NY',
      postal_code: '10001',
      country: 'US',
      currency: 'usd',
      created_at: new Date('2023-12-10'),
      updated_at: new Date('2024-01-25'),
    },
    {
      id: uuidv4(),
      stripe_customer_id: 'cus_sample_004',
      email: 'emma.brown@freelancer.dev',
      name: 'Emma Brown',
      company: 'Freelance Developer',
      phone: '+1-555-321-0987',
      address_line1: '321 Code Lane',
      city: 'Seattle',
      state: 'WA',
      postal_code: '98101',
      country: 'US',
      currency: 'usd',
      created_at: new Date('2024-02-01'),
      updated_at: new Date('2024-02-01'),
    },
    {
      id: uuidv4(),
      stripe_customer_id: 'cus_sample_005',
      email: 'david.martinez@agency.com',
      name: 'David Martinez',
      company: 'Creative Agency Co.',
      phone: '+1-555-654-3210',
      address_line1: '654 Design Street',
      city: 'Los Angeles',
      state: 'CA',
      postal_code: '90210',
      country: 'US',
      currency: 'usd',
      created_at: new Date('2024-01-05'),
      updated_at: new Date('2024-01-30'),
    },
  ];

  await knex('customers').insert(customers);

  // Sample subscriptions
  const subscriptions = [
    {
      id: uuidv4(),
      stripe_subscription_id: 'sub_sample_001',
      customer_id: customers[0].id, // John Doe - Premium Plan
      plan_id: premiumPlan.id,
      status: 'active',
      current_period_start: new Date('2024-01-15'),
      current_period_end: new Date('2024-02-15'),
      trial_start: null,
      trial_end: null,
      cancel_at: null,
      canceled_at: null,
      cancel_at_period_end: false,
      quantity: 1,
      discount_percentage: 0,
      metadata: JSON.stringify({ source: 'website' }),
      created_at: new Date('2024-01-15'),
      updated_at: new Date('2024-01-15'),
    },
    {
      id: uuidv4(),
      stripe_subscription_id: 'sub_sample_002',
      customer_id: customers[1].id, // Sarah Wilson - Pro Plan
      plan_id: proPlan.id,
      status: 'active',
      current_period_start: new Date('2024-01-20'),
      current_period_end: new Date('2024-02-20'),
      trial_start: new Date('2024-01-20'),
      trial_end: new Date('2024-02-03'),
      cancel_at: null,
      canceled_at: null,
      cancel_at_period_end: false,
      quantity: 1,
      discount_percentage: 0,
      metadata: JSON.stringify({ source: 'api', trial_converted: true }),
      created_at: new Date('2024-01-20'),
      updated_at: new Date('2024-02-03'),
    },
    {
      id: uuidv4(),
      stripe_subscription_id: 'sub_sample_003',
      customer_id: customers[2].id, // Michael Chen - Pro Plan
      plan_id: proPlan.id,
      status: 'active',
      current_period_start: new Date('2023-12-10'),
      current_period_end: new Date('2024-01-10'),
      trial_start: null,
      trial_end: null,
      cancel_at: null,
      canceled_at: null,
      cancel_at_period_end: false,
      quantity: 3, // Team subscription
      discount_percentage: 10, // Enterprise discount
      metadata: JSON.stringify({ source: 'sales', team_size: 15 }),
      created_at: new Date('2023-12-10'),
      updated_at: new Date('2024-01-25'),
    },
    {
      id: uuidv4(),
      stripe_subscription_id: 'sub_sample_004',
      customer_id: customers[3].id, // Emma Brown - Trialing
      plan_id: premiumPlan.id,
      status: 'trialing',
      current_period_start: new Date('2024-02-01'),
      current_period_end: new Date('2024-03-01'),
      trial_start: new Date('2024-02-01'),
      trial_end: new Date('2024-02-15'),
      cancel_at: null,
      canceled_at: null,
      cancel_at_period_end: false,
      quantity: 1,
      discount_percentage: 0,
      metadata: JSON.stringify({ source: 'referral', referrer: 'john.doe@techcorp.com' }),
      created_at: new Date('2024-02-01'),
      updated_at: new Date('2024-02-01'),
    },
    {
      id: uuidv4(),
      stripe_subscription_id: 'sub_sample_005',
      customer_id: customers[4].id, // David Martinez - Past Due
      plan_id: premiumPlan.id,
      status: 'past_due',
      current_period_start: new Date('2024-01-05'),
      current_period_end: new Date('2024-02-05'),
      trial_start: null,
      trial_end: null,
      cancel_at: null,
      canceled_at: null,
      cancel_at_period_end: false,
      quantity: 1,
      discount_percentage: 0,
      metadata: JSON.stringify({ source: 'website' }),
      created_at: new Date('2024-01-05'),
      updated_at: new Date('2024-02-07'),
    },
  ];

  await knex('subscriptions').insert(subscriptions);

  // Sample payment methods
  const paymentMethods = [
    {
      id: uuidv4(),
      stripe_payment_method_id: 'pm_sample_001',
      customer_id: customers[0].id,
      type: 'card',
      card_brand: 'visa',
      card_last_four: '4242',
      card_exp_month: 12,
      card_exp_year: 2025,
      is_default: true,
      created_at: new Date('2024-01-15'),
      updated_at: new Date('2024-01-15'),
    },
    {
      id: uuidv4(),
      stripe_payment_method_id: 'pm_sample_002',
      customer_id: customers[1].id,
      type: 'card',
      card_brand: 'mastercard',
      card_last_four: '5555',
      card_exp_month: 8,
      card_exp_year: 2026,
      is_default: true,
      created_at: new Date('2024-01-20'),
      updated_at: new Date('2024-01-20'),
    },
    {
      id: uuidv4(),
      stripe_payment_method_id: 'pm_sample_003',
      customer_id: customers[2].id,
      type: 'card',
      card_brand: 'amex',
      card_last_four: '0005',
      card_exp_month: 3,
      card_exp_year: 2027,
      is_default: true,
      created_at: new Date('2023-12-10'),
      updated_at: new Date('2023-12-10'),
    },
  ];

  await knex('payment_methods').insert(paymentMethods);

  // Sample invoices
  const invoices = [
    {
      id: uuidv4(),
      stripe_invoice_id: 'in_sample_001',
      customer_id: customers[0].id,
      subscription_id: subscriptions[0].id,
      invoice_number: 'INV-2024-001',
      status: 'paid',
      amount_due: 9.99,
      amount_paid: 9.99,
      amount_remaining: 0,
      currency: 'usd',
      due_date: new Date('2024-01-15'),
      paid_at: new Date('2024-01-15'),
      hosted_invoice_url: 'https://invoice.stripe.com/i/sample_001',
      invoice_pdf_url: 'https://invoice.stripe.com/i/sample_001/pdf',
      metadata: JSON.stringify({ billing_period: '2024-01' }),
      created_at: new Date('2024-01-15'),
      updated_at: new Date('2024-01-15'),
    },
    {
      id: uuidv4(),
      stripe_invoice_id: 'in_sample_002',
      customer_id: customers[1].id,
      subscription_id: subscriptions[1].id,
      invoice_number: 'INV-2024-002',
      status: 'paid',
      amount_due: 19.99,
      amount_paid: 19.99,
      amount_remaining: 0,
      currency: 'usd',
      due_date: new Date('2024-02-03'),
      paid_at: new Date('2024-02-03'),
      hosted_invoice_url: 'https://invoice.stripe.com/i/sample_002',
      invoice_pdf_url: 'https://invoice.stripe.com/i/sample_002/pdf',
      metadata: JSON.stringify({ billing_period: '2024-02', trial_conversion: true }),
      created_at: new Date('2024-02-03'),
      updated_at: new Date('2024-02-03'),
    },
    {
      id: uuidv4(),
      stripe_invoice_id: 'in_sample_003',
      customer_id: customers[2].id,
      subscription_id: subscriptions[2].id,
      invoice_number: 'INV-2024-003',
      status: 'paid',
      amount_due: 53.97, // 19.99 * 3 * 0.9 (10% discount)
      amount_paid: 53.97,
      amount_remaining: 0,
      currency: 'usd',
      due_date: new Date('2024-01-10'),
      paid_at: new Date('2024-01-10'),
      hosted_invoice_url: 'https://invoice.stripe.com/i/sample_003',
      invoice_pdf_url: 'https://invoice.stripe.com/i/sample_003/pdf',
      metadata: JSON.stringify({ billing_period: '2024-01', quantity: 3, discount: 10 }),
      created_at: new Date('2024-01-10'),
      updated_at: new Date('2024-01-10'),
    },
    {
      id: uuidv4(),
      stripe_invoice_id: 'in_sample_004',
      customer_id: customers[4].id,
      subscription_id: subscriptions[4].id,
      invoice_number: 'INV-2024-004',
      status: 'open',
      amount_due: 9.99,
      amount_paid: 0,
      amount_remaining: 9.99,
      currency: 'usd',
      due_date: new Date('2024-02-05'),
      paid_at: null,
      hosted_invoice_url: 'https://invoice.stripe.com/i/sample_004',
      invoice_pdf_url: null,
      metadata: JSON.stringify({ billing_period: '2024-02', payment_failed: true }),
      created_at: new Date('2024-02-05'),
      updated_at: new Date('2024-02-07'),
    },
  ];

  await knex('invoices').insert(invoices);

  // Sample usage records
  const usageRecords = [];
  const metrics = ['api_calls', 'characters_processed', 'voice_minutes', 'storage_mb'];

  // Generate usage data for the last 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    customers.forEach((customer, customerIndex) => {
      // Skip usage for customers without active subscriptions
      const subscription = subscriptions.find((s) => s.customer_id === customer.id);
      if (!subscription || subscription.status === 'canceled') return;

      metrics.forEach((metric) => {
        // Generate realistic usage patterns
        let quantity = 0;
        switch (metric) {
          case 'api_calls':
            quantity = Math.floor(Math.random() * 100) + customerIndex * 50;
            break;
          case 'characters_processed':
            quantity = Math.floor(Math.random() * 5000) + customerIndex * 2000;
            break;
          case 'voice_minutes':
            quantity = Math.floor(Math.random() * 30) + customerIndex * 10;
            break;
          case 'storage_mb':
            quantity = Math.floor(Math.random() * 100) + customerIndex * 50;
            break;
        }

        if (quantity > 0) {
          usageRecords.push({
            id: uuidv4(),
            customer_id: customer.id,
            subscription_id: subscription.id,
            metric_name: metric,
            quantity,
            timestamp: date,
            metadata: JSON.stringify({
              daily_batch: true,
              processed_at: date.toISOString(),
            }),
            created_at: date,
          });
        }
      });
    });
  }

  // Insert usage records in batches
  const batchSize = 100;
  for (let i = 0; i < usageRecords.length; i += batchSize) {
    const batch = usageRecords.slice(i, i + batchSize);
    await knex('usage_records').insert(batch);
  }

  // Sample failed payments
  const failedPayments = [
    {
      id: uuidv4(),
      customer_id: customers[4].id, // David Martinez
      subscription_id: subscriptions[4].id,
      stripe_payment_intent_id: 'pi_sample_failed_001',
      amount: 9.99,
      currency: 'usd',
      failure_reason: 'Your card was declined.',
      failure_code: 'card_declined',
      retry_count: 1,
      next_retry_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      resolved: false,
      resolved_at: null,
      created_at: new Date('2024-02-06'),
      updated_at: new Date('2024-02-07'),
    },
  ];

  await knex('failed_payments').insert(failedPayments);

  // Sample promotional codes
  const promoCodes = [
    {
      id: uuidv4(),
      stripe_coupon_id: 'coup_sample_welcome20',
      code: 'WELCOME20',
      name: 'Welcome Discount',
      percent_off: 20,
      amount_off: null,
      currency: null,
      duration: 'once',
      duration_in_months: null,
      max_redemptions: 1000,
      times_redeemed: 45,
      is_active: true,
      expires_at: new Date('2024-12-31'),
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-02-01'),
    },
    {
      id: uuidv4(),
      stripe_coupon_id: 'coup_sample_student50',
      code: 'STUDENT50',
      name: 'Student Discount',
      percent_off: 50,
      amount_off: null,
      currency: null,
      duration: 'repeating',
      duration_in_months: 12,
      max_redemptions: 500,
      times_redeemed: 23,
      is_active: true,
      expires_at: new Date('2024-08-31'),
      created_at: new Date('2024-01-15'),
      updated_at: new Date('2024-02-01'),
    },
    {
      id: uuidv4(),
      stripe_coupon_id: 'coup_sample_save10',
      code: 'SAVE10',
      name: 'Save $10',
      percent_off: null,
      amount_off: 10.0,
      currency: 'usd',
      duration: 'once',
      duration_in_months: null,
      max_redemptions: 100,
      times_redeemed: 8,
      is_active: true,
      expires_at: new Date('2024-06-30'),
      created_at: new Date('2024-02-01'),
      updated_at: new Date('2024-02-01'),
    },
  ];

  await knex('promotional_codes').insert(promoCodes);

  // Sample webhook events
  const webhookEvents = [
    {
      id: uuidv4(),
      stripe_event_id: 'evt_sample_001',
      event_type: 'customer.subscription.created',
      processed: true,
      processed_at: new Date('2024-01-15'),
      error_message: null,
      retry_count: 0,
      data: JSON.stringify({
        id: 'sub_sample_001',
        object: 'subscription',
        customer: 'cus_sample_001',
        status: 'active',
      }),
      created_at: new Date('2024-01-15'),
    },
    {
      id: uuidv4(),
      stripe_event_id: 'evt_sample_002',
      event_type: 'invoice.payment_succeeded',
      processed: true,
      processed_at: new Date('2024-01-15'),
      error_message: null,
      retry_count: 0,
      data: JSON.stringify({
        id: 'in_sample_001',
        object: 'invoice',
        customer: 'cus_sample_001',
        amount_paid: 999,
      }),
      created_at: new Date('2024-01-15'),
    },
    {
      id: uuidv4(),
      stripe_event_id: 'evt_sample_003',
      event_type: 'invoice.payment_failed',
      processed: true,
      processed_at: new Date('2024-02-06'),
      error_message: null,
      retry_count: 0,
      data: JSON.stringify({
        id: 'in_sample_004',
        object: 'invoice',
        customer: 'cus_sample_005',
        amount_due: 999,
      }),
      created_at: new Date('2024-02-06'),
    },
  ];

  await knex('webhook_events').insert(webhookEvents);

  console.log('✅ Sample data seeded successfully');
  console.log(`   📊 Created ${customers.length} customers`);
  console.log(`   💳 Created ${subscriptions.length} subscriptions`);
  console.log(`   🏦 Created ${paymentMethods.length} payment methods`);
  console.log(`   📄 Created ${invoices.length} invoices`);
  console.log(`   📈 Created ${usageRecords.length} usage records`);
  console.log(`   ❌ Created ${failedPayments.length} failed payments`);
  console.log(`   🎟️  Created ${promoCodes.length} promotional codes`);
  console.log(`   🔗 Created ${webhookEvents.length} webhook events`);
}
