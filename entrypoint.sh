#!/bin/sh
set -e

echo "🔄 OpenClaw Hotel — Starting up..."

# Wait for database to be ready (healthcheck should handle this, but extra safety)
echo "⏳ Waiting for database..."
sleep 2

# Run database migrations
echo "🗄️  Running database migrations..."
if npm run migrate; then
  echo "✅ Migrations complete"
else
  echo "⚠️  Migration warnings (check logs above)"
fi

# Start the server
echo "🚀 Starting server..."
exec node dist/server.js
