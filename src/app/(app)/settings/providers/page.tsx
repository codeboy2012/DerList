/**
 * Provider Settings Page
 *
 * Single page for managing all API providers (AI, Shopping, Price).
 * Uses tabs to separate categories. One form component for all types.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProviderSettings } from './ProviderSettings';

export default async function ProvidersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  // Get user's configured providers (raw from DB — client handles display)
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

  // Serialize dates for client component
  const serializedProviders = providers.map((p) => ({
    ...p,
    lastHealthCheck: p.lastHealthCheck?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API Providers</h1>
        <p className="text-muted-foreground mt-2">
          Configure external services for AI, product search, and price tracking. Providers are used
          automatically — no manual switching required.
        </p>
      </div>

      <ProviderSettings providers={serializedProviders} />
    </div>
  );
}
