/**
 * GET /api/admin/providers — List all available providers with catalog info.
 * Returns the full provider catalog for the admin dashboard.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ALL_PROVIDERS, PROVIDER_COUNTS } from '@/lib/providers/registry/catalog';
import { getAllMetrics } from '@/lib/providers/registry/metrics';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const metrics = getAllMetrics();
  const metricsMap = new Map(metrics.map((m) => [m.providerId, m]));

  const providers = ALL_PROVIDERS.map((p) => ({
    ...p,
    metrics: metricsMap.get(p.id) ?? null,
  }));

  return NextResponse.json({
    providers,
    counts: PROVIDER_COUNTS,
    metrics: metrics.length > 0 ? metrics : [],
  });
}
