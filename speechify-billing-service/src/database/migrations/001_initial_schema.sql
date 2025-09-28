-- Migration: 001_initial_schema.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enum types
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired');
CREATE TYPE plan_type AS ENUM ('free', 'premium', 'pro');
CREATE TYPE billing_interval AS ENUM ('month', 'year');
CREATE TYPE payment_status AS ENUM ('succeeded', 'pending', 'failed', 'canceled');
CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'uncollectible', 'void');

-- Customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    company VARCHAR(255),
    phone VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2),
    tax_id VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'usd',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Subscription plans table
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_product_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_price_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    plan_type plan_type NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd',
    billing_interval billing_interval NOT NULL,
    billing_interval_count INTEGER DEFAULT 1,
    usage_limit INTEGER,
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status subscription_status NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    cancel_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    quantity INTEGER DEFAULT 1,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment methods table
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    card_brand VARCHAR(50),
    card_last_four VARCHAR(4),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100),
    status invoice_status NOT NULL,
    amount_due DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    amount_remaining DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd',
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    hosted_invoice_url TEXT,
    invoice_pdf_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking table
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    metric_name VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook events table
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Failed payments table
CREATE TABLE failed_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd',
    failure_reason VARCHAR(255),
    failure_code VARCHAR(100),
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Promotional codes table
CREATE TABLE promotional_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_coupon_id VARCHAR(255) UNIQUE NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255),
    percent_off DECIMAL(5,2),
    amount_off DECIMAL(10,2),
    currency VARCHAR(3),
    duration VARCHAR(50) NOT NULL, -- 'once', 'repeating', 'forever'
    duration_in_months INTEGER,
    max_redemptions INTEGER,
    times_redeemed INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_stripe_id ON customers(stripe_customer_id);
CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_payment_methods_customer_id ON payment_methods(customer_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_usage_records_customer_id ON usage_records(customer_id);
CREATE INDEX idx_usage_records_timestamp ON usage_records(timestamp);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_failed_payments_customer_id ON failed_payments(customer_id);
CREATE INDEX idx_failed_payments_resolved ON failed_payments(resolved);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_failed_payments_updated_at BEFORE UPDATE ON failed_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_promotional_codes_updated_at BEFORE UPDATE ON promotional_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();