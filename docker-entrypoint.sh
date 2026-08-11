#!/bin/sh
set -e

# ─────────────────────────────────────────────────────────────────────────────
# DerList Docker Entrypoint
#
# 1. Wait for PostgreSQL to be ready
# 2. Run Prisma migrations (fails on error — no silent masking)
# 3. Optionally seed the database with an owner account
# 4. Start the application via exec (replaces shell process)
# ─────────────────────────────────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════╗"
echo "║          DerList — Starting Up...            ║"
echo "╚══════════════════════════════════════════════╝"

# ── Validate required environment ──
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set. Cannot start."
  exit 1
fi

# ── Wait for PostgreSQL ──
echo "⏳ Waiting for database..."

# Extract host and port from DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_PORT=${DB_PORT:-5432}

RETRIES=30
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -eq 0 ]; then
    echo "❌ Could not connect to PostgreSQL at $DB_HOST:$DB_PORT after 60 seconds."
    exit 1
  fi
  echo "  Waiting for PostgreSQL at $DB_HOST:$DB_PORT... ($RETRIES attempts left)"
  sleep 2
done

echo "✅ Database is ready."

# ── Run Prisma Migrations ──
echo "🔄 Running database migrations..."
npx prisma migrate deploy
echo "✅ Migrations applied."

# ── Optional: Seed database with owner account ──
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ] && [ -n "$ADMIN_USERNAME" ]; then
  echo "🌱 Running seed..."
  npx tsx prisma/seed.ts || {
    echo "⚠️  Seed failed (non-fatal — continuing startup)."
  }
fi

# ── Start Application ──
echo "🚀 Starting DerList..."
exec node server.js
