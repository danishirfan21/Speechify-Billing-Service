# Speechify Billing Service

A comprehensive subscription management microservice built with TypeScript, Node.js, and PostgreSQL, featuring Stripe integration for handling billing, payments, and subscription lifecycle management.

## 🏗️ Architecture Overview

```mermaid
graph TB
    A[Client Applications] --> B[Load Balancer]
    B --> C[API Gateway]
    C --> D[Billing Service]
    D --> E[PostgreSQL Database]
    D --> F[Redis Cache]
    D --> G[Stripe API]
    D --> H[Email Service]
    I[Stripe Webhooks] --> D
    D --> J[Admin Dashboard]
    D --> K[Analytics Engine]
```

### Core Components

- **Billing Service**: Core TypeScript/Node.js microservice
- **PostgreSQL**: Primary database for billing data
- **Redis**: Caching and session management
- **Stripe**: Payment processing and subscription management
- **Email Service**: Automated billing notifications
- **Admin Dashboard**: React-based management interface
- **Webhook Handler**: Real-time Stripe event processing

## 🚀 Features

### ✅ Core Billing Features
- **Customer Management**: Create, update, and manage customer profiles
- **Subscription Plans**: Free, Premium ($9.99/month), Pro ($19.99/month)
- **Payment Processing**: Secure Stripe integration with PCI DSS compliance
- **Invoice Management**: Automated invoice generation and payment tracking
- **Webhook Processing**: Real-time event handling from Stripe
- **Usage Tracking**: API calls, characters processed, voice minutes
- **Proration**: Automatic billing adjustments for plan changes

### ✅ Advanced Features
- **Dunning Management**: Automated retry logic for failed payments
- **Email Notifications**: Comprehensive billing event notifications
- **Multi-currency Support**: USD, EUR, GBP, CAD, AUD, JPY
- **Promotional Codes**: Discount management and validation
- **Analytics Dashboard**: Revenue, churn, and usage analytics
- **Admin Interface**: Complete subscription management portal

### ✅ Technical Features
- **TypeScript**: Full type safety and modern JavaScript features
- **Rate Limiting**: Protection against API abuse
- **Authentication**: JWT and API key-based authentication
- **Validation**: Comprehensive input validation with Joi
- **Error Handling**: Structured error responses and logging
- **Health Checks**: Service monitoring and diagnostics
- **API Documentation**: OpenAPI/Swagger integration

## 📋 Prerequisites

- **Node.js**: 18.x or higher
- **PostgreSQL**: 14.x or higher
- **Redis**: 6.x or higher
- **Stripe Account**: Test and live mode credentials
- **SMTP Server**: For email notifications

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/speechify/billing-service.git
cd billing-service
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

```bash
cp .env.example .env
```

Configure your environment variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/speechify_billing
DB_HOST=localhost
DB_PORT=5432
DB_NAME=speechify_billing
DB_USER=username
DB_PASSWORD=password

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=billing@speechify.com
```

### 4. Database Setup

```bash
# Create database
createdb speechify_billing

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

### 5. Start the Service

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## 📖 API Documentation

### Base URL
```
http://localhost:3000/api/billing
```

### Authentication
All API endpoints require authentication via API key:

```bash
curl -H "x-api-key: YOUR_API_KEY" https://api.speechify.com/api/billing/customers
```

### Core Endpoints

#### Customer Management

**Create Customer**
```http
POST /api/billing/customers
Content-Type: application/json
x-api-key: YOUR_API_KEY

{
  "email": "customer@example.com",
  "name": "John Doe",
  "company": "Acme Corp",
  "address": {
    "line1": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "postal_code": "94105",
    "country": "US"
  }
}
```

**Get Customer**
```http
GET /api/billing/customers/{customerId}
x-api-key: YOUR_API_KEY
```

#### Subscription Management

**Create Subscription**
```http
POST /api/billing/subscribe
Content-Type: application/json
x-api-key: YOUR_API_KEY

{
  "customer_id": "customer-uuid",
  "plan_id": "plan-uuid",
  "payment_method_id": "pm_1234567890",
  "trial_days": 14,
  "quantity": 1
}
```

**Update Subscription**
```http
PUT /api/billing/subscription/{subscriptionId}
Content-Type: application/json
x-api-key: YOUR_API_KEY

{
  "plan_id": "new-plan-uuid",
  "quantity": 2,
  "prorate": true
}
```

**Cancel Subscription**
```http
DELETE /api/billing/subscription/{subscriptionId}?immediately=false
x-api-key: YOUR_API_KEY
```

#### Usage Tracking

**Record Usage**
```http
POST /api/billing/usage
Content-Type: application/json
x-api-key: YOUR_API_KEY

{
  "customer_id": "customer-uuid",
  "metric_name": "api_calls",
  "quantity": 100,
  "metadata": {
    "endpoint": "/api/text-to-speech",
    "characters": 1500
  }
}
```

**Get Usage Statistics**
```http
GET /api/billing/usage/{customerId}
x-api-key: YOUR_API_KEY
```

### Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "message": "Please provide a valid email address"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🔄 Webhook Integration

### Stripe Webhook Endpoint

```http
POST /api/billing/webhooks/stripe
Content-Type: application/json
Stripe-Signature: webhook_signature
```

### Supported Events

- `customer.created` - Customer created in Stripe
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription modified
- `customer.subscription.deleted` - Subscription canceled
- `invoice.payment_succeeded` - Payment successful
- `invoice.payment_failed` - Payment failed
- `customer.subscription.trial_will_end` - Trial ending soon

### Webhook Security

Webhooks are verified using Stripe's signature verification:

```typescript
const event = stripe.webhooks.constructEvent(
  payload,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

## 📊 Database Schema

### Key Tables

**customers**
- `id` (UUID, Primary Key)
- `stripe_customer_id` (String, Unique)
- `email` (String, Unique)
- `name`, `company`, `phone`
- `address` fields
- `created_at`, `updated_at`

**subscription_plans**
- `id` (UUID, Primary Key)
- `stripe_product_id`, `stripe_price_id`
- `name`, `description`
- `plan_type` (enum: free, premium, pro)
- `amount`, `currency`
- `billing_interval` (enum: month, year)
- `usage_limit`

**subscriptions**
- `id` (UUID, Primary Key)
- `stripe_subscription_id` (String, Unique)
- `customer_id` (Foreign Key)
- `plan_id` (Foreign Key)
- `status` (enum: active, canceled, past_due, etc.)
- `current_period_start`, `current_period_end`
- `trial_start`, `trial_end`

**usage_records**
- `id` (UUID, Primary Key)
- `customer_id` (Foreign Key)
- `metric_name` (String)
- `quantity` (Integer)
- `timestamp`

### Database Migrations

```bash
# Create new migration
npm run knex migrate:make migration_name

# Run migrations
npm run db:migrate

# Rollback migrations
npm run db:rollback
```

## 🔧 Configuration

### Subscription Plans

Configure your subscription plans in the database:

```sql
INSERT INTO subscription_plans (
  name, plan_type, amount, currency, billing_interval,
  stripe_product_id, stripe_price_id, usage_limit
) VALUES 
('Free Plan', 'free', 0.00, 'usd', 'month', 'prod_free', 'price_free', 10000),
('Premium Plan', 'premium', 9.99, 'usd', 'month', 'prod_premium', 'price_premium', 100000),
('Pro Plan', 'pro', 19.99, 'usd', 'month', 'prod_pro', 'price_pro', 1000000);
```

### Rate Limiting

Configure rate limits in your environment:

```env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # Max requests per window
```

### Email Templates

Email templates are built-in but can be customized in `src/services/email.service.ts`.

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Test Coverage

```bash
npm run test:coverage
```

### Example Test

```typescript
describe('Billing Service', () => {
  it('should create a customer', async () => {
    const customerData = {
      email: 'test@example.com',
      name: 'Test Customer'
    };
    
    const customer = await billingService.createCustomer(customerData);
    
    expect(customer.email).toBe(customerData.email);
    expect(customer.stripe_customer_id).toBeDefined();
  });
});
```

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY knexfile.js ./

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  billing-service:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/billing
    depends_on:
      - postgres
      - redis
  
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: billing
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:6-alpine
    
volumes:
  postgres_data:
```

### Environment-Specific Deployment

**Staging**
```bash
npm run build
NODE_ENV=staging npm start
```

**Production**
```bash
npm run build
NODE_ENV=production npm start
```

### Health Checks

The service includes health check endpoints:

```http
GET /health
GET /api/billing/health
```

## 📈 Monitoring & Analytics

### Metrics Collection

Key metrics tracked:
- Monthly Recurring Revenue (MRR)
- Annual Recurring Revenue (ARR)
- Customer Churn Rate
- Usage per Customer
- Failed Payment Rate

### Logging

Structured logging with Winston:

```typescript
logger.info('Customer created', {
  customerId: customer.id,
  email: customer.email,
  plan: 'premium'
});
```

### Performance Monitoring

- Database query optimization
- Redis caching for frequently accessed data
- Rate limiting and request throttling
- Error tracking and alerting

## 🔒 Security

### PCI DSS Compliance

- No sensitive card data stored
- All payments processed through Stripe
- Webhook signature verification
- Encrypted data transmission

### Authentication & Authorization

- JWT tokens for web dashboard
- API keys for programmatic access
- Role-based access control for admin functions
- Rate limiting to prevent abuse

### Data Protection

- Password hashing with bcrypt
- Input validation and sanitization
- SQL injection prevention
- XSS protection with helmet

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check database connection
psql -h localhost -U username -d speechify_billing

# Verify environment variables
echo $DATABASE_URL
```

**Stripe API Errors**
```bash
# Test Stripe connectivity
curl -H "Authorization: Bearer $STRIPE_SECRET_KEY" \
  https://api.stripe.com/v1/customers
```

**Webhook Verification Failures**
- Ensure webhook secret is correctly configured
- Check request timestamp tolerance
- Verify webhook URL is accessible

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
```

### Common Error Codes

- `CUSTOMER_NOT_FOUND` - Customer does not exist
- `SUBSCRIPTION_ALREADY_EXISTS` - Customer already has active subscription
- `PAYMENT_FAILED` - Payment processing failed
- `INVALID_PLAN` - Subscription plan not found
- `USAGE_LIMIT_EXCEEDED` - Customer exceeded usage limits

## 📚 Additional Resources

### API Documentation
- **Swagger UI**: `http://localhost:3000/api/docs`
- **Postman Collection**: Available in `/docs/postman/`

### Database Documentation
- **Schema Diagrams**: Available in `/docs/database/`
- **Migration Guide**: `/docs/migrations.md`

### Integration Guides
- **Stripe Setup**: `/docs/stripe-setup.md`
- **Email Configuration**: `/docs/email-setup.md`
- **Webhook Testing**: `/docs/webhook-testing.md`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Follow conventional commits
- Ensure all tests pass

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:

- **Email**: engineering@speechify.com
- **Documentation**: https://docs.speechify.com/billing
- **Issues**: https://github.com/speechify/billing-service/issues