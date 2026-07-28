/**
 * GET /api/health — Application health check endpoint.
 *
 * Used by Docker healthchecks, Caddy's depends_on condition, and monitoring.
 *
 * Checks:
 *   - Application is running (implicit — if this responds, Next.js is up)
 *   - Database connectivity via a lightweight SELECT 1
 *   - Prisma client is operational
 *
 * Returns HTTP 200 when healthy, HTTP 503 when degraded.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();

  // ── Database + Prisma check ─────────────────────────────────────────────
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  let prismaStatus: 'ok' | 'error' = 'error';
  let dbLatencyMs: number | null = null;
  let dbError: string | null = null;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = 'connected';
    prismaStatus = 'ok';
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'Unknown database error';
  }

  // ── Aggregate status ────────────────────────────────────────────────────
  const healthy = dbStatus === 'connected';
  const status = healthy ? 'ok' : 'degraded';
  const httpStatus = healthy ? 200 : 503;

  return NextResponse.json(
    {
      status,
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      responseMs: Date.now() - start,
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          ...(dbError ? { error: dbError } : {}),
        },
        prisma: {
          status: prismaStatus,
        },
        application: {
          status: 'ok',
        },
      },
    },
    { status: httpStatus }
  );
}
