/**
 * POST /api/providers/health — Run health checks on all providers.
 * GET  /api/providers/health — Get current health status of all providers.
 *
 * POST triggers actual connectivity checks.
 * GET returns cached status from the DB.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkAllProviderHealth } from '@/lib/services/integration-service';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const providers = await prisma.providerConfiguration.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        providerId: true,
        name: true,
        enabled: true,
        lastStatus: true,
        lastHealthCheck: true,
        lastSuccessAt: true,
        lastErrorAt: true,
        lastError: true,
      },
    });

    const health = providers.map((p) => ({
      id: p.id,
      providerId: p.providerId,
      name: p.name,
      enabled: p.enabled,
      status: (p.lastStatus ?? 'UNKNOWN').toLowerCase(),
      lastCheck: p.lastHealthCheck?.toISOString() ?? null,
      lastSuccess: p.lastSuccessAt?.toISOString() ?? null,
      lastError: p.lastError,
      lastErrorAt: p.lastErrorAt?.toISOString() ?? null,
    }));

    return NextResponse.json({ health });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get health status.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const results = await checkAllProviderHealth(user.id);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Health check failed.' },
      { status: 500 }
    );
  }
}
