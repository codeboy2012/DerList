/**
 * Integrations Page — Unified Integration Catalog
 *
 * Replaces the old separate provider pickers with a single modern
 * integration management experience.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { IntegrationCatalog } from './IntegrationCatalog';

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const providers = await prisma.providerConfiguration.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      providerId: true,
      name: true,
      category: true,
      enabled: true,
      priority: true,
      isDefault: true,
      lastStatus: true,
      lastHealthCheck: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ category: 'asc' }, { priority: 'asc' }],
  });

  const serialized = providers.map((p) => ({
    ...p,
    lastHealthCheck: p.lastHealthCheck?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  // Feature routing config
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { aiProviderConfig: true },
  });
  const config = (dbUser?.aiProviderConfig as Record<string, unknown>) ?? {};
  const routing = (config.featureRouting as Record<string, string>) ?? {};

  return <IntegrationCatalog configuredProviders={serialized} featureRouting={routing} />;
}
