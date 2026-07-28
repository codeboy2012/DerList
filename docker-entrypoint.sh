#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# DerList — Docker Entrypoint
#
# Startup sequence:
#   1. Validate required environment variables
#   2. Wait for PostgreSQL to accept connections
#   3. Run `prisma migrate deploy` (idempotent — safe on every start)
#   4. Generate Prisma Client if the binary is missing
#   5. Seed the database only when the users table is empty
#   6. Start the Next.js application
#
# `docker compose up -d` is all you ever need.
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ── Logging helpers ───────────────────────────────────────────────────────────

log()     { printf '[derlist] %s  %s\n'   "$(date '+%H:%M:%S')" "$1"; }
success() { printf '[derlist] %s  ✓ %s\n' "$(date '+%H:%M:%S')" "$1"; }
warn()    { printf '[derlist] %s  ⚠ %s\n' "$(date '+%H:%M:%S')" "$1" >&2; }
die()     { printf '[derlist] %s  ✗ %s\n' "$(date '+%H:%M:%S')" "$1" >&2; exit 1; }

# ── 1. Validate required environment variables ────────────────────────────────

validate_env() {
  MISSING=""

  for VAR in AUTH_SECRET PROVIDER_ENCRYPTION_KEY DATABASE_URL; do
    eval VAL=\$$VAR
    if [ -z "$VAL" ]; then
      MISSING="$MISSING\n  • $VAR"
    fi
  done

  if [ -n "$MISSING" ]; then
    echo ""
    echo "  ╔══════════════════════════════════════════════════════════╗"
    echo "  ║           DerList — Missing Required Variables           ║"
    echo "  ╠══════════════════════════════════════════════════════════╣"
    printf "  ║  The following variables must be set in your .env file: ║\n"
    printf "%b" "$MISSING" | while IFS= read -r line; do
      printf "  ║  %-56s ║\n" "$line"
    done
    echo "  ║                                                          ║"
    echo "  ║  Run:  cp .env.example .env  and fill in the values.    ║"
    echo "  ╚══════════════════════════════════════════════════════════╝"
    echo ""
    exit 1
  fi

  success "Environment validated"
}

# ── 2. Wait for PostgreSQL ────────────────────────────────────────────────────

wait_for_db() {
  log "Waiting for PostgreSQL..."

  MAX_RETRIES=30
  INTERVAL=2
  ATTEMPT=0

  while [ "$ATTEMPT" -lt "$MAX_RETRIES" ]; do
    if node -e "
      const { Client } = require('pg');
      const c = new Client({ connectionString: process.env.DATABASE_URL });
      c.connect()
        .then(() => { c.end(); process.exit(0); })
        .catch(() => process.exit(1));
    " 2>/dev/null; then
      success "PostgreSQL connected"
      return 0
    fi

    ATTEMPT=$((ATTEMPT + 1))
    log "  PostgreSQL not ready (attempt ${ATTEMPT}/${MAX_RETRIES}) — retrying in ${INTERVAL}s..."
    sleep "$INTERVAL"
  done

  die "PostgreSQL did not become ready after $((MAX_RETRIES * INTERVAL))s — aborting"
}

# ── 3. Run Prisma migrations ──────────────────────────────────────────────────

run_migrations() {
  log "Running Prisma migrations..."

  if npx prisma migrate deploy 2>&1; then
    success "Migrations applied"
  else
    die "prisma migrate deploy failed — check your DATABASE_URL and migration files"
  fi
}

# ── 4. Generate Prisma Client if missing ─────────────────────────────────────

ensure_prisma_client() {
  if [ -f "node_modules/.prisma/client/index.js" ]; then
    success "Prisma client ready"
    return 0
  fi

  log "Generating Prisma client..."
  if npx prisma generate 2>&1; then
    success "Prisma client generated"
  else
    die "prisma generate failed"
  fi
}

# ── 5. Seed only when the users table is empty ────────────────────────────────

maybe_seed() {
  # Seeding is only possible when admin credentials are provided
  if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ] || [ -z "$ADMIN_USERNAME" ]; then
    warn "ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_USERNAME not set — skipping seed"
    return 0
  fi

  log "Checking whether seed is needed..."

  USER_COUNT=$(node -e "
    const { Client } = require('pg');
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    c.connect()
      .then(() => c.query('SELECT COUNT(*) FROM users'))
      .then(r => { console.log(r.rows[0].count); c.end(); process.exit(0); })
      .catch(err => { console.error(err.message); process.exit(1); });
  " 2>/dev/null)

  if [ "$USER_COUNT" = "0" ]; then
    log "No users found — seeding initial admin account..."
    if npx prisma db seed 2>&1; then
      success "Admin account created"
    else
      die "Seed failed — check ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_USERNAME in .env"
    fi
  else
    success "Admin exists — skipping seed"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo "  ╔══════════════════════════════════════════════════════════╗"
  echo "  ║                  Starting DerList                        ║"
  echo "  ╚══════════════════════════════════════════════════════════╝"
  echo ""

  validate_env
  wait_for_db
  run_migrations
  ensure_prisma_client
  maybe_seed

  echo ""
  success "Starting DerList..."
  echo ""

  exec node server.js
}

main "$@"
