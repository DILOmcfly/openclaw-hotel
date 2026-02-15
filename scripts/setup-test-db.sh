#!/bin/bash

# Setup Test Database for Integration Tests
#
# This script creates the openclaw_hotel_test database and test user.
# Run once before running integration tests.

set -e

# Configuration
DB_NAME="openclaw_hotel_test"
DB_USER="${TEST_DB_USER:-openclaw}"
DB_PASSWORD="${TEST_DB_PASSWORD:-openclaw}"
DB_HOST="${TEST_DB_HOST:-localhost}"
DB_PORT="${TEST_DB_PORT:-5432}"

echo "🔧 Setting up test database..."
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Host: $DB_HOST:$DB_PORT"
echo ""

# Check if PostgreSQL is running
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" > /dev/null 2>&1; then
  echo "❌ PostgreSQL is not running on $DB_HOST:$DB_PORT"
  echo "   Please start PostgreSQL and try again."
  exit 1
fi

# Create test user if it doesn't exist
echo "📝 Creating test user..."
psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -tc "SELECT 1 FROM pg_user WHERE usename = '$DB_USER'" | grep -q 1 || \
  psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"

# Create test database if it doesn't exist
echo "📝 Creating test database..."
psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
  psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# Grant privileges
echo "🔑 Granting privileges..."
psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

echo ""
echo "✅ Test database setup complete!"
echo ""
echo "   Connection URL: postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo "   To run integration tests:"
echo "   npm test -- src/tests/integration"
echo ""
