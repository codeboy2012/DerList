'use client';

/**
 * IntegrationCatalog — Main UI for the unified integration management system.
 *
 * Displays category tabs, search, provider grid, and configuration panels.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  Brain,
  Code,
  Image,
  Plus,
  Search,
  ShoppingCart,
  TrendingDown,
  Workflow,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  getIntegrationsByCategory,
  INTEGRATION_CATALOG,
  INTEGRATION_COUNTS,
  searchIntegrations,
} from '@/lib/providers/registry/integration-catalog';
import {
  CATEGORIES,
  type IntegrationCatalogEntry,
  type IntegrationCategory,
} from '@/lib/providers/registry/integration-types';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { CustomApiBuilder } from './CustomApiBuilder';
import { FeatureRoutingPanel } from './FeatureRoutingPanel';
import { ProviderAnalyticsPanel } from './ProviderAnalyticsPanel';
import { ProviderCard } from './ProviderCard';
import { ProviderConfigPanel } from './ProviderConfigPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Icon Map
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<IntegrationCategory, typeof Brain> = {
  ai: Brain,
  search: Search,
  shopping: ShoppingCart,
  price: TrendingDown,
  media: Image,
  automation: Workflow,
  custom: Code,
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SerializedProvider {
  id: string;
  providerId: string;
  name: string;
  category: string;
  enabled: boolean;
  priority: number;
  isDefault: boolean;
  lastStatus: string;
  lastHealthCheck: string | null;
  createdAt: string;
  updatedAt: string;
}

interface IntegrationCatalogProps {
  configuredProviders: SerializedProvider[];
  featureRouting: Record<string, string>;
}

type ViewMode = 'catalog' | 'configure' | 'routing' | 'analytics' | 'custom-api';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function IntegrationCatalog({
  configuredProviders: initialProviders,
  featureRouting,
}: IntegrationCatalogProps) {
  const [providers, setProviders] = useState(initialProviders);
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('catalog');
  const [selectedEntry, setSelectedEntry] = useState<IntegrationCatalogEntry | null>(null);
  const [editingProvider, setEditingProvider] = useState<SerializedProvider | null>(null);
  const toast = useToast();

  // ─── Derived State ───

  const filteredEntries = useMemo(() => {
    let entries: IntegrationCatalogEntry[];
    if (searchQuery.trim()) {
      entries = searchIntegrations(searchQuery);
    } else if (activeCategory === 'all') {
      entries = INTEGRATION_CATALOG;
    } else {
      entries = getIntegrationsByCategory(activeCategory);
    }
    return entries;
  }, [activeCategory, searchQuery]);

  const connectedIds = useMemo(() => new Set(providers.map((p) => p.providerId)), [providers]);

  // ─── Handlers ───

  const handleAddIntegration = useCallback((entry: IntegrationCatalogEntry) => {
    setSelectedEntry(entry);
    setEditingProvider(null);
    setViewMode('configure');
  }, []);

  const handleEditProvider = useCallback((provider: SerializedProvider) => {
    const entry = INTEGRATION_CATALOG.find((e) => e.id === provider.providerId);
    if (entry) {
      setSelectedEntry(entry);
      setEditingProvider(provider);
      setViewMode('configure');
    }
  }, []);

  const handleBack = useCallback(() => {
    setViewMode('catalog');
    setSelectedEntry(null);
    setEditingProvider(null);
  }, []);

  const handleProviderSaved = useCallback(
    (saved: SerializedProvider) => {
      setProviders((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      setViewMode('catalog');
      setSelectedEntry(null);
      setEditingProvider(null);
      toast.success(`${saved.name} saved`);
    },
    [toast]
  );

  const handleProviderDeleted = useCallback(
    (id: string) => {
      setProviders((prev) => prev.filter((p) => p.id !== id));
      toast.success('Integration removed');
    },
    [toast]
  );

  const handleToggleEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      try {
        const res = await fetch(`/api/providers/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
        if (res.ok) {
          setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)));
          toast.success(enabled ? 'Integration enabled' : 'Integration disabled');
        }
      } catch {
        toast.error('Failed to update integration');
      }
    },
    [toast]
  );

  // ─── Render: Custom API Builder ───

  if (viewMode === 'custom-api') {
    return <CustomApiBuilder onBack={handleBack} onSaved={handleProviderSaved} />;
  }

  // ─── Render: Configuration Panel ───

  if (viewMode === 'configure' && selectedEntry) {
    return (
      <ProviderConfigPanel
        entry={selectedEntry}
        existingProvider={editingProvider}
        onBack={handleBack}
        onSaved={handleProviderSaved}
      />
    );
  }

  // ─── Render: Feature Routing ───

  if (viewMode === 'routing') {
    return (
      <FeatureRoutingPanel providers={providers} routing={featureRouting} onBack={handleBack} />
    );
  }

  // ─── Render: Analytics ───

  if (viewMode === 'analytics') {
    return <ProviderAnalyticsPanel providers={providers} onBack={handleBack} />;
  }

  // ─── Render: Main Catalog ───

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Integrations</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect AI, search, shopping, and automation services. {INTEGRATION_COUNTS.total}{' '}
            integrations available.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode('custom-api')}
            className={cn(
              'bg-accent inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium',
              'text-accent-foreground hover:bg-accent/90 transition-colors'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Custom API
          </button>
          <button
            type="button"
            onClick={() => setViewMode('routing')}
            className={cn(
              'border-border rounded-lg border px-3 py-2 text-sm font-medium',
              'text-muted-foreground hover:bg-surface hover:text-foreground transition-colors'
            )}
          >
            Feature Routing
          </button>
          <button
            type="button"
            onClick={() => setViewMode('analytics')}
            className={cn(
              'border-border rounded-lg border px-3 py-2 text-sm font-medium',
              'text-muted-foreground hover:bg-surface hover:text-foreground transition-colors'
            )}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Search integrations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          aria-label="Search integrations"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Integration categories">
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
            activeCategory === 'all'
              ? 'bg-accent/10 text-accent ring-accent/20 shadow-sm ring-1'
              : 'text-muted-foreground hover:bg-surface hover:text-foreground'
          )}
        >
          All
          <span
            className={cn(
              'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
              activeCategory === 'all'
                ? 'bg-accent text-accent-foreground'
                : 'bg-surface text-muted-foreground'
            )}
          >
            {INTEGRATION_COUNTS.total}
          </span>
        </button>
        {CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id];
          const count = getIntegrationsByCategory(cat.id).length;
          const isActive = activeCategory === cat.id;
          const connectedCount = providers.filter(
            (p) => p.category.toLowerCase() === cat.id || p.category === cat.id.toUpperCase()
          ).length;

          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-accent/10 text-accent ring-accent/20 shadow-sm ring-1'
                  : 'text-muted-foreground hover:bg-surface hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {cat.label}
              <span
                className={cn(
                  'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                  isActive ? 'bg-accent text-accent-foreground' : 'bg-surface text-muted-foreground'
                )}
              >
                {count}
              </span>
              {connectedCount > 0 && (
                <span
                  className="bg-success flex h-2 w-2 rounded-full"
                  title={`${connectedCount} connected`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Connected Providers Section */}
      {providers.length > 0 && activeCategory === 'all' && !searchQuery && (
        <section aria-labelledby="connected-heading">
          <h2 id="connected-heading" className="mb-3 text-base font-semibold">
            Connected ({providers.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => {
              const entry = INTEGRATION_CATALOG.find((e) => e.id === provider.providerId);
              return (
                <ProviderCard
                  key={provider.id}
                  entry={
                    entry ?? {
                      id: provider.providerId,
                      name: provider.name,
                      category: 'custom' as IntegrationCategory,
                      description: '',
                      website: '',
                      requiredConfig: [],
                    }
                  }
                  configured={provider}
                  onConfigure={() => handleEditProvider(provider)}
                  onToggle={(enabled) => handleToggleEnabled(provider.id, enabled)}
                  onDelete={() => handleProviderDeleted(provider.id)}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Available Integrations Grid */}
      <section aria-labelledby="available-heading">
        <h2 id="available-heading" className="mb-3 text-base font-semibold">
          {searchQuery ? `Results (${filteredEntries.length})` : 'Available Integrations'}
        </h2>
        {filteredEntries.length === 0 ? (
          <div className="border-border bg-card rounded-xl border p-12 text-center">
            <Search className="text-muted mx-auto h-8 w-8" />
            <p className="text-muted-foreground mt-3 text-sm">
              No integrations found for &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredEntries.map((entry) => {
              const configured = providers.find((p) => p.providerId === entry.id);
              return (
                <ProviderCard
                  key={entry.id}
                  entry={entry}
                  configured={configured ?? null}
                  onConfigure={() =>
                    configured ? handleEditProvider(configured) : handleAddIntegration(entry)
                  }
                  onToggle={
                    configured
                      ? (enabled) => handleToggleEnabled(configured.id, enabled)
                      : undefined
                  }
                  onDelete={configured ? () => handleProviderDeleted(configured.id) : undefined}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
