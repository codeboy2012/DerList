/**
 * Unified Providers Page
 *
 * All provider categories in one view with feature routing.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FeatureRouting } from './FeatureRouting';
import { ProviderSettings } from './ProviderSettings';

export default async function ProvidersPage() {
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
    },
    orderBy: [{ category: 'asc' }, { priority: 'asc' }],
  });

  const serializedProviders = providers.map((p) => ({
    ...p,
    lastHealthCheck: p.lastHealthCheck?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  // Get feature routing
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { aiProviderConfig: true },
  });
  const config = (dbUser?.aiProviderConfig as Record<string, unknown>) ?? {};
  const routing = (config.featureRouting as Record<string, string>) ?? {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Providers</h1>
        <p className="text-muted-foreground mt-1">
          Manage AI, search, and price tracking services. Choose which provider powers each feature.
        </p>
      </div>

      {/* Feature Routing */}
      <FeatureRouting
        routing={routing}
        providers={serializedProviders.map((p) => ({
          id: p.providerId,
          name: p.name,
          category: p.category,
          enabled: p.enabled,
        }))}
      />

      {/* Provider Management */}
      <ProviderSettings providers={serializedProviders} />
    </div>
  );
}
