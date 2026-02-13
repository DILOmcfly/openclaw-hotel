#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting OpenClaw Hotel dev environment..."

docker compose up -d

echo "⏳ Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U openclaw -d openclaw_hotel >/dev/null 2>&1; do
  sleep 1
done
echo "✅ PostgreSQL ready"

echo "⏳ Waiting for Redis..."
until docker compose exec -T redis redis-cli ping >/dev/null 2>&1; do
  sleep 1
done
echo "✅ Redis ready"

echo "🎉 Dev environment ready!"
echo "  PostgreSQL: localhost:5432"
echo "  Redis:      localhost:6379"
echo "  Run: npm run dev"
