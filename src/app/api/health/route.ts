/**
 * GET /api/health — Application health check endpoint.
 *
 * Verifies:
 * - Application is running
 * - Database is reachable
 *
 * Used by Docker health checks and monitoring.
 * Does NOT require authentication.
 */

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();

  try {
    // Verify database connectivity with a lightweight query
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - start;

    return Response.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          status: 'connected',
          latency: `${dbLatency}ms`,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const dbLatency = Date.now() - start;

    return Response.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          status: 'disconnected',
          latency: `${dbLatency}ms`,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 503 }
    );
  }
}
