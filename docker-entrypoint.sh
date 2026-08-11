#!/bin/sh
set -e

# ─────────────────────────────────────────────────────────────────────────────
# DerList Docker Entrypoint
#
# Handles:
# 1. Wait for PostgreSQL to be ready
# 2. Run Prisma migrations (safe for restarts — only applies pending)
# 3. Optionally seed the database with an owner account
# 4. Start the application
# ─────────────────────────────────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════╗"
echo "║          DerList — Starting Up...            ║"
echo "╚══════════════════════════════════════════════╝"

# ── Wait for PostgreSQL ──
echo "⏳ Waiting for database..."

# Extract host and port from DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_PORT=${DB_PORT:-5432}

# Wait up to 60 seconds for PostgreSQL
RETRIES=30
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null || [ $RETRIES -eq 0 ]; do
  RETRIES=$((RETRIES - 1))
  echo "  Waiting for PostgreSQL at $DB_HOST:$DB_PORT... ($RETRIES attempts left)"
  sleep 2
done

if [ $RETRIES -eq 0 ]; then
  echo "❌ Could not connect to PostgreSQL at $DB_HOST:$DB_PORT after 60 seconds."
  exit 1
fi

echo "✅ Database is ready."

# ── Run Prisma Migrations ──
echo "🔄 Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma
echo "✅ Migrations applied."

# ── Optional: Seed database with owner account ──
# Only runs if ADMIN_EMAIL is set AND the database has no users yet
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ] && [ -n "$ADMIN_USERNAME" ]; then
  echo "🌱 Checking if seed is needed..."
  # Use a simple check — seed script itself is idempotent (checks for existing user)
  npx tsx prisma/seed.ts 2>&1 || echo "⚠️  Seed skipped or already applied."
fi

# ── Start Application ──
echo "🚀 Starting DerList..."
exec node server.js
