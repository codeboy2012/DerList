# ─────────────────────────────────────────────────────────────────────────────
# DerList — Production Dockerfile
#
# Multi-stage build for a minimal, secure production image.
#
# Stages:
#   1. deps    — install all npm dependencies
#   2. builder — generate Prisma client + build Next.js standalone output
#   3. runner  — lean production image (no build tools, no dev deps)
#
# The entrypoint script handles migrations and seeding automatically —
# no manual Prisma commands are ever needed after `docker compose up -d`.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ── Stage 2: Build the application ───────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy installed deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Generate Prisma Client (required for type resolution during build)
RUN npx prisma generate

# Build Next.js standalone output
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# tini: proper PID 1 — forwards signals and reaps zombie processes
RUN apk add --no-cache tini

# Create non-root user/group
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nextjs

# ── Copy Next.js standalone output ───────────────────────────────────────────
# standalone/ contains server.js + a trimmed node_modules with only runtime deps
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# ── Copy Prisma artefacts needed at runtime ───────────────────────────────────
# schema + migrations  → prisma migrate deploy
# generated client     → query engine binary used by @prisma/client
COPY --from=builder --chown=nextjs:nodejs /app/prisma                        ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma          ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma          ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma           ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma      ./node_modules/.bin/prisma

# ── Copy pg driver (used by entrypoint DB-readiness probe) ────────────────────
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg               ./node_modules/pg
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-protocol      ./node_modules/pg-protocol
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-types         ./node_modules/pg-types

# ── Copy entrypoint ───────────────────────────────────────────────────────────
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./docker-entrypoint.sh"]
