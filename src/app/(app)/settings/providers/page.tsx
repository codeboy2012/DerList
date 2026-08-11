/**
 * Unified Providers Page
 *
 * All provider categories in one view with feature routing.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AI_PROVIDERS, SEARCH_PROVIDERS, PRICE_PROVIDERS } from '@/lib/providers/registry/catalog';
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

  // Build available providers list from the authoritative catalog
  // Map catalog entries to the shape the client component expects
  const availableProviders = [...AI_PROVIDERS, ...SEARCH_PROVIDERS, ...PRICE_PROVIDERS].map((entry) => ({
    id: entry.id,
    name: entry.name,
    category: entry.category === 'ai' ? 'AI' : entry.category === 'search' ? 'SHOPPING_SEARCH' : 'PRICE',
    description: entry.description,
    fields: [
      ...entry.requiredConfig.map((f) => ({
        name: f.key,
        label: f.label,
        type: f.type,
        placeholder: f.placeholder,
        required: true,
      })),
      ...(entry.optionalConfig ?? []).map((f) => ({
        name: f.key,
        label: f.label,
        type: f.type === 'select' ? 'text' : f.type,
        placeholder: f.placeholder ?? (f.options ? f.options[0] : undefined),
        required: false,
      })),
    ],
    free: entry.free,
    freeTier: entry.freeTier,
  }));

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
      <ProviderSettings providers={serializedProviders} availableProviders={availableProviders} />
    </div>
  );
}
