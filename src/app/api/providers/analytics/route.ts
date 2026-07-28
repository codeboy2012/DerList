/**
 * GET /api/providers/analytics — Get real usage analytics for all configured providers.
 * GET /api/providers/analytics?id=xxx — Get detailed analytics for a specific provider.
 *
 * Returns per-provider stats with time-series data for charting.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getProviderAnalytics } from '@/lib/services/integration-service';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const specificId = url.searchParams.get('id');

  try {
    // Single provider detail
    if (specificId) {
      const analytics = await getProviderAnalytics(user.id, specificId);
      if (!analytics) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
      }
      return NextResponse.json({ analytics });
    }

    // All providers summary
    const providers = await prisma.providerConfiguration.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        providerId: true,
        name: true,
        lastStatus: true,
        lastHealthCheck: true,
        lastSuccessAt: true,
        lastError: true,
      },
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Batch fetch usage data
    const usageRecords = await prisma.providerUsage.findMany({
      where: { userId: user.id, createdAt: { gte: monthStart } },
      select: {
        providerConfigId: true,
        success: true,
        responseTime: true,
        estimatedCost: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    // Aggregate per provider
    const analyticsMap = new Map<
      string,
      {
        requestsToday: number;
        requestsMonth: number;
        avgLatency: number;
        totalLatency: number;
        latencyCount: number;
        errors: number;
        cost: number;
        lastError: string | null;
      }
    >();

    for (const record of usageRecords) {
      const id = record.providerConfigId;
      if (!id) continue;
      let entry = analyticsMap.get(id);
      if (!entry) {
        entry = {
          requestsToday: 0,
          requestsMonth: 0,
          avgLatency: 0,
          totalLatency: 0,
          latencyCount: 0,
          errors: 0,
          cost: 0,
          lastError: null,
        };
        analyticsMap.set(id, entry);
      }

      entry.requestsMonth++;
      if (record.createdAt >= todayStart) entry.requestsToday++;
      if (!record.success) {
        entry.errors++;
        entry.lastError = record.errorMessage;
      }
      if (record.responseTime) {
        entry.totalLatency += record.responseTime;
        entry.latencyCount++;
      }
      if (record.estimatedCost) entry.cost += Number(record.estimatedCost);
    }

    // Compute averages
    for (const entry of analyticsMap.values()) {
      entry.avgLatency =
        entry.latencyCount > 0 ? Math.round(entry.totalLatency / entry.latencyCount) : 0;
    }

    const analytics = providers.map((p) => {
      const usage = analyticsMap.get(p.id);
      const successRate = usage
        ? usage.requestsMonth > 0
          ? Math.round(((usage.requestsMonth - usage.errors) / usage.requestsMonth) * 100)
          : 100
        : 100;

      return {
        providerId: p.id,
        providerName: p.name,
        catalogId: p.providerId,
        status: (p.lastStatus ?? 'UNKNOWN').toLowerCase(),
        latencyMs: usage?.avgLatency ?? 0,
        lastHealthCheck: p.lastHealthCheck?.toISOString() ?? null,
        requestsToday: usage?.requestsToday ?? 0,
        requestsMonth: usage?.requestsMonth ?? 0,
        remainingCredits: null,
        estimatedCost: usage?.cost ?? null,
        errorCount: usage?.errors ?? 0,
        lastError: usage?.lastError ?? p.lastError ?? null,
        successRate,
        avgResponseTime: usage?.avgLatency ?? 0,
        lastSuccessfulRequest: p.lastSuccessAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ analytics });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load analytics.' },
      { status: 500 }
    );
  }
}
