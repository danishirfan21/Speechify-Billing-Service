#!/bin/bash

# Speechify Billing Service Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up Speechify Billing Service..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18 or higher is required. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL not found. Please install PostgreSQL 14+ manually.${NC}"
    echo "Visit: https://www.postgresql.org/download/"
else
    echo -e "${GREEN}✓ PostgreSQL detected${NC}"
fi

# Check if Redis is installed
if ! command -v redis-cli &> /dev/null; then
    echo -e "${YELLOW}⚠️  Redis not found. Please install Redis 6+ manually.${NC}"
    echo "Visit: https://redis.io/download"
else
    echo -e "${GREEN}✓ Redis detected${NC}"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "📝 Setting up environment variables..."

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}⚠️  Please update .env with your actual configuration values${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists, skipping...${NC}"
fi

# Create .env.test file if it doesn't exist
if [ ! -f .env.test ]; then
    echo "Creating .env.test file..."
    cp .env.test.example .env.test 2>/dev/null || cat > .env.test << 'EOF'
NODE_ENV=test
PORT=3001
LOG_LEVEL=error

# Test Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=speechify_billing_test
DB_USER=postgres
DB_PASSWORD=password

# Test Redis
REDIS_URL=redis://localhost:6379/1

# Test Stripe
STRIPE_SECRET_KEY=sk_test_mock_key
STRIPE_WEBHOOK_SECRET=whsec_test_secret

# Test Auth
JWT_SECRET=test_jwt_secret
API_KEY=sk_test_valid_key
EOF
    echo -e "${GREEN}✓ .env.test file created${NC}"
fi

echo ""
echo "🗄️  Setting up databases..."

# Function to create database
create_database() {
    DB_NAME=$1
    echo "Creating database: $DB_NAME"
    
    # Try to create the database
    createdb -h localhost -U postgres $DB_NAME 2>/dev/null && \
        echo -e "${GREEN}✓ Database $DB_NAME created${NC}" || \
        echo -e "${YELLOW}⚠️  Database $DB_NAME already exists or couldn't be created${NC}"
}

# Check if we can connect to PostgreSQL
if command -v psql &> /dev/null; then
    read -p "Would you like to create the databases? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_database "speechify_billing"
        create_database "speechify_billing_test"
        
        echo ""
        echo "Running database migrations..."
        npm run db:migrate
        echo -e "${GREEN}✓ Migrations completed${NC}"
        
        read -p "Would you like to seed the database with sample data? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Seeding database..."
            npm run db:seed
            echo -e "${GREEN}✓ Database seeded${NC}"
        fi
    fi
fi

echo ""
echo "📁 Creating required directories..."
mkdir -p logs
mkdir -p coverage
echo -e "${GREEN}✓ Directories created${NC}"

echo ""
echo "🔧 Building TypeScript..."
npm run build
echo -e "${GREEN}✓ Build completed${NC}"

echo ""
echo "🧪 Running tests..."
npm test
TEST_RESULT=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Setup completed successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Setup completed with test warnings${NC}"
fi

echo ""
echo "📋 Next steps:"
echo ""
echo "1. Update your .env file with actual values:"
echo "   - Set your Stripe API keys (get from https://stripe.com/docs/keys)"
echo "   - Configure your SMTP settings for email notifications"
echo "   - Update database credentials if needed"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Visit the API documentation:"
echo "   http://localhost:3000/api/docs"
echo ""
echo "4. Test the health endpoint:"
echo "   curl http://localhost:3000/health"
echo ""
echo "📚 Additional resources:"
echo "   - README.md for full documentation"
echo "   - docs/ folder for detailed guides"
echo "   - .env.example for all configuration options"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""