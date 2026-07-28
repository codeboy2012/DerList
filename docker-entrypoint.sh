#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# DerList Docker Entrypoint
#
# Handles the full startup sequence:
#   1. Wait for PostgreSQL to be ready
#   2. Run Prisma migrations (creates tables on first run)
#   3. Generate Prisma Client if needed
#   4. Start the Next.js application
#
# This script ensures `docker compose up -d` is all you ever need.
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ─── Helpers ──────────────────────────────────────────────────────────────────

log() {
  echo "[derlist] $(date '+%H:%M:%S') $1"
}

success() {
  echo "[derlist] $(date '+%H:%M:%S') ✓ $1"
}

error() {
  echo "[derlist] $(date '+%H:%M:%S') ✗ $1" >&2
}

# ─── Wait for Database ────────────────────────────────────────────────────────

wait_for_db() {
  log "Waiting for PostgreSQL..."

  MAX_RETRIES=30
  RETRY_INTERVAL=2
  RETRIES=0

  while [ $RETRIES -lt $MAX_RETRIES ]; do
    if node -e "
      const { Client } = require('pg');
      const c = new Client({ connectionString: process.env.DATABASE_URL });
      c.connect().then(() => { c.end(); process.exit(0); }).catch(() => process.exit(1));
    " 2>/dev/null; then
      success "Database ready"
      return 0
    fi

    RETRIES=$((RETRIES + 1))
    sleep $RETRY_INTERVAL
  done

  error "Database not reachable after $((MAX_RETRIES * RETRY_INTERVAL))s"
  exit 1
}

# ─── Run Migrations ──────────────────────────────────────────────────────────

run_migrations() {
  log "Running Prisma migrations..."

  if npx prisma migrate deploy 2>&1; then
    success "Database migrated"
  else
    error "Migration failed — attempting db push as fallback..."
    if npx prisma db push --skip-generate 2>&1; then
      success "Database schema pushed"
    else
      error "Database initialization failed"
      exit 1
    fi
  fi
}

# ─── Generate Prisma Client ──────────────────────────────────────────────────

generate_client() {
  # Check if Prisma Client is already generated
  if [ -d "node_modules/.prisma/client" ] && [ -f "node_modules/.prisma/client/index.js" ]; then
    success "Prisma Client already generated"
    return 0
  fi

  log "Generating Prisma Client..."
  if npx prisma generate 2>&1; then
    success "Prisma Client generated"
  else
    error "Prisma Client generation failed"
    exit 1
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
  log "Starting DerList..."
  echo ""

  # Step 1: Wait for database
  wait_for_db

  # Step 2: Run migrations (idempotent — safe to run every startup)
  run_migrations

  # Step 3: Generate Prisma Client if needed
  generate_client

  echo ""
  log "Starting Next.js application..."
  success "Ready"
  echo ""

  # Step 4: Start the application
  exec node server.js
}

main "$@"
