# ─────────────────────────────────────────────────────────────────────────────
# DerList Production Dockerfile
# Multi-stage build for minimal image size.
# Includes automatic migration support via entrypoint script.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Prisma client ──
# The generated client contains the platform-independent WASM query compiler.
# Generate it once on the build platform so arm64 builds do not have to run the
# Prisma schema engine under QEMU.
FROM --platform=$BUILDPLATFORM node:26-alpine AS prisma-client
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN npm ci --omit=dev
RUN npx prisma generate

# ── Stage 2: Dependencies ──
FROM node:26-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN npm ci --omit=dev
# Use the client generated once on the build platform (needed for seed at runtime)
COPY --from=prisma-client /app/node_modules/.prisma ./node_modules/.prisma

# ── Stage 3: Build ──
FROM node:26-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY --from=prisma-client /app/node_modules/.prisma ./node_modules/.prisma

COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 4: Production ──
FROM node:26-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install runtime dependencies needed for:
# - pg_isready: database readiness check in entrypoint
RUN apk add --no-cache postgresql-client

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create uploads directory owned by runtime user
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

# Worker startup helper (same image, different command)

# Copy production dependencies (includes prisma CLI, dotenv, tsx for seed)
# Use --chown to avoid slow recursive chown on large node_modules
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Copy Prisma schema + migrations (needed for runtime migrate deploy)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Copy Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy worker sources and TypeScript config.
# The worker runs through tsx (a production dependency) using the same
# standalone image, so it does not need a second build stage.
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

LABEL org.opencontainers.image.title="DerList"
LABEL org.opencontainers.image.description="A private, self-hosted wishlist and personal product organizer."
LABEL org.opencontainers.image.source="https://github.com/codeboy2012/DerList"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="DerList"

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check against the dedicated health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
