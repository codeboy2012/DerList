/**
 * GET /api/health — Application health check endpoint.
 *
 * Used by Docker health checks and monitoring.
 * Verifies database connectivity and returns app status.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();

  let dbStatus: 'connected' | 'disconnected' = 'disconnected';
  let dbLatency: number | null = null;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  const status = dbStatus === 'connected' ? 'ok' : 'degraded';
  const httpStatus = dbStatus === 'connected' ? 200 : 503;

  return NextResponse.json(
    {
      status,
      database: dbStatus,
      dbLatencyMs: dbLatency,
      version: process.env.npm_package_version || '0.1.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      responseMs: Date.now() - start,
    },
    { status: httpStatus }
  );
}
