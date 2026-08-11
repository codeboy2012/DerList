'use client';

/**
 * ProviderSettings — Premium UI for managing provider configurations.
 *
 * Three tabs: AI, Shopping, Price.
 * Each tab shows configured providers as rich cards.
 * Adding a provider uses a modal dialog.
 */
import { useCallback, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  DollarSign,
  ExternalLink,
  Globe,
  Key,
  Loader2,
  Plus,
  Power,
  Settings2,
  ShoppingCart,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal, useDisclosure } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ConfiguredProvider {
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
}

interface AvailableProvider {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: { name: string; label: string; type: string; placeholder?: string; required?: boolean }[];
  free?: boolean;
  freeTier?: string;
}

// Provider list is passed from the server component (from the authoritative catalog)
// No hard-coded provider definitions here.

type TabId = 'AI' | 'SHOPPING_SEARCH' | 'PRICE';

const TABS: { id: TabId; label: string; icon: typeof Bot; description: string }[] = [
  {
    id: 'AI',
    label: 'AI Models',
    icon: Bot,
    description: 'Language models for chat and product identification',
  },
  {
    id: 'SHOPPING_SEARCH',
    label: 'Shopping',
    icon: ShoppingCart,
    description: 'Product search and price comparison',
  },
  {
    id: 'PRICE',
    label: 'Price Tracking',
    icon: DollarSign,
    description: 'Price history and alerts',
  },
];

// Provider brand config for visual treatment
const PROVIDER_BRAND: Record<string, { icon: typeof Bot; color: string; gradient: string }> = {
  openrouter: {
    icon: Globe,
    color: 'text-violet-500',
    gradient: 'from-violet-500/10 to-purple-500/10',
  },
  openai: {
    icon: Sparkles,
    color: 'text-emerald-500',
    gradient: 'from-emerald-500/10 to-teal-500/10',
  },
  serpapi: {
    icon: Globe,
    color: 'text-blue-500',
    gradient: 'from-blue-500/10 to-cyan-500/10',
  },
  keepa: {
    icon: DollarSign,
    color: 'text-orange-500',
    gradient: 'from-orange-500/10 to-amber-500/10',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface ProviderSettingsProps {
  providers: ConfiguredProvider[];
  availableProviders: AvailableProvider[];
}

export function ProviderSettings({ providers: initialProviders, availableProviders }: ProviderSettingsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('AI');
  const [providers, setProviders] = useState(initialProviders);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; message: string }>
  >({});
  const addModal = useDisclosure();
  const toast = useToast();

  const tabProviders = providers.filter((p) => p.category === activeTab);
  const tabAvailable = availableProviders.filter((p) => p.category === activeTab);
  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  // ─── Actions ───

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this provider? This cannot be undone.')) return;
    setIsDeleting(id);

    try {
      const res = await fetch(`/api/providers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProviders((prev) => prev.filter((p) => p.id !== id));
        toast.success('Provider removed successfully');
      } else {
        toast.error('Failed to remove provider');
      }
    } catch {
      toast.error('Failed to remove provider');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleTest = async (id: string) => {
    setIsTesting(id);
    setTestResults((prev) => ({ ...prev, [id]: { success: false, message: 'Testing...' } }));

    try {
      const res = await fetch(`/api/providers/${id}/test`, { method: 'POST' });
      const data = await res.json();
      const result = {
        success: data.success,
        message: data.message || (data.success ? 'Connection healthy' : 'Connection failed'),
      };
      setTestResults((prev) => ({ ...prev, [id]: result }));
      if (data.success) {
        toast.success(`${providers.find((p) => p.id === id)?.name}: Connection verified`);
      } else {
        toast.error(`${providers.find((p) => p.id === id)?.name}: ${result.message}`);
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, message: 'Test failed' } }));
      toast.error('Connection test failed');
    } finally {
      setIsTesting(null);
    }
  };

  const handleAdd = useCallback(
    async (providerId: string, config: Record<string, string>) => {
      const providerDef = availableProviders.find((p) => p.id === providerId);
      if (!providerDef) return;

      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          category: providerDef.category,
          name: providerDef.name,
          config,
        }),
      });

      const data = await res.json();
      if (data.success && data.provider) {
        setProviders((prev) => [...prev, data.provider]);
        addModal.onClose();
        toast.success(`${providerDef.name} connected successfully`);
      } else {
        throw new Error(data.error || 'Failed to add provider');
      }
    },
    [addModal, toast, availableProviders]
  );

  // ─── Render ───

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex gap-2">
        {TABS.map((tab) => {
          const count = providers.filter((p) => p.category === tab.id).length;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-accent/10 text-accent ring-accent/20 shadow-sm ring-1'
                  : 'text-muted-foreground hover:bg-surface hover:text-foreground'
              )}
            >
              <tab.icon className={cn('h-4 w-4', isActive && 'text-accent')} />
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-surface text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{activeTabMeta.label}</h2>
          <p className="text-muted-foreground text-sm">{activeTabMeta.description}</p>
        </div>
        <Button onClick={addModal.onOpen} className="gap-2 shadow-sm" size="md">
          <Plus className="h-4 w-4" />
          Add Provider
        </Button>
      </div>

      {/* Provider Cards Grid */}
      {tabProviders.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {tabProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              testResult={testResults[provider.id]}
              isTesting={isTesting === provider.id}
              isDeleting={isDeleting === provider.id}
              onTest={() => handleTest(provider.id)}
              onDelete={() => handleDelete(provider.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState tab={activeTabMeta} onAdd={addModal.onOpen} />
      )}

      {/* Add Provider Modal */}
      <Modal
        open={addModal.open}
        onClose={addModal.onClose}
        title={`Add ${activeTabMeta.label} Provider`}
        description="Choose a provider and enter your API credentials to get started."
        size="lg"
      >
        <div className="space-y-4">
          {tabAvailable.map((available) => (
            <AddProviderCard
              key={available.id}
              provider={available}
              isConfigured={providers.some((p) => p.providerId === available.id)}
              onAdd={handleAdd}
            />
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Card
// ─────────────────────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  testResult,
  isTesting,
  isDeleting,
  onTest,
  onDelete,
}: {
  provider: ConfiguredProvider;
  testResult?: { success: boolean; message: string };
  isTesting: boolean;
  isDeleting: boolean;
  onTest: () => void;
  onDelete: () => void;
}) {
  const brand = PROVIDER_BRAND[provider.providerId] || {
    icon: Settings2,
    color: 'text-muted-foreground',
    gradient: 'from-gray-500/10 to-gray-400/10',
  };
  const BrandIcon = brand.icon;

  const statusLabel =
    provider.lastStatus === 'HEALTHY'
      ? 'Healthy'
      : provider.lastStatus === 'UNHEALTHY'
        ? 'Unhealthy'
        : 'Unknown';

  const statusVariant =
    provider.lastStatus === 'HEALTHY'
      ? 'success'
      : provider.lastStatus === 'UNHEALTHY'
        ? 'danger'
        : ('secondary' as const);

  return (
    <Card className="group relative overflow-hidden transition-shadow duration-200 hover:shadow-md">
      {/* Gradient accent bar */}
      <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', brand.gradient)} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br',
                brand.gradient
              )}
            >
              <BrandIcon className={cn('h-5 w-5', brand.color)} />
            </div>
            <div>
              <h3 className="leading-tight font-semibold">{provider.name}</h3>
              <p className="text-muted-foreground text-xs">{provider.providerId}</p>
            </div>
          </div>

          {/* Status badge */}
          <Badge variant={statusVariant} className="text-xs">
            {statusLabel}
          </Badge>
        </div>

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {provider.isDefault && (
            <Badge variant="accent" className="gap-1 text-xs">
              <Zap className="h-3 w-3" />
              Default
            </Badge>
          )}
          <Badge variant="outline" className="gap-1 text-xs">
            Priority {provider.priority}
          </Badge>
          {provider.enabled ? (
            <Badge variant="success" className="gap-1 text-xs">
              <Check className="h-3 w-3" />
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Disabled
            </Badge>
          )}
        </div>

        {/* Test result */}
        {testResult && (
          <div
            className={cn(
              'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium',
              testResult.success ? 'bg-success/5 text-success' : 'bg-danger/5 text-danger'
            )}
          >
            {testResult.success ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            {testResult.message}
          </div>
        )}

        {/* Actions */}
        <div className="border-border mt-4 flex items-center gap-2 border-t pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onTest}
            disabled={isTesting}
            className="gap-2"
          >
            {isTesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )}
            Test
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-muted-foreground hover:text-danger gap-2"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Remove
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  tab,
  onAdd,
}: {
  tab: { id: TabId; label: string; icon: typeof Bot; description: string };
  onAdd: () => void;
}) {
  const TabIcon = tab.icon;
  return (
    <Card className="border-dashed">
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="bg-surface flex h-14 w-14 items-center justify-center rounded-2xl">
          <TabIcon className="text-muted-foreground h-6 w-6" />
        </div>
        <h3 className="mt-4 font-semibold">No {tab.label.toLowerCase()} providers</h3>
        <p className="text-muted-foreground mt-1.5 max-w-sm text-sm">
          {tab.description}. Add a provider to unlock these features.
        </p>
        <Button onClick={onAdd} className="mt-6 gap-2" size="md">
          <Plus className="h-4 w-4" />
          Add {tab.label} Provider
        </Button>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Provider Card (inside modal)
// ─────────────────────────────────────────────────────────────────────────────

function AddProviderCard({
  provider,
  isConfigured,
  onAdd,
}: {
  provider: AvailableProvider;
  isConfigured: boolean;
  onAdd: (providerId: string, config: Record<string, string>) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brand = PROVIDER_BRAND[provider.id] || {
    icon: Settings2,
    color: 'text-muted-foreground',
    gradient: 'from-gray-500/10 to-gray-400/10',
  };
  const BrandIcon = brand.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const requiredFields = provider.fields.filter((f) => f.required !== false);
    for (const field of requiredFields) {
      if (!config[field.name]?.trim()) {
        setError(`${field.label} is required.`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onAdd(provider.id, config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add provider.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'border-border rounded-xl border transition-all duration-200',
        expanded ? 'bg-card ring-accent/10 shadow-sm ring-1' : 'hover:bg-card/50',
        isConfigured && 'opacity-60'
      )}
    >
      {/* Provider header (clickable) */}
      <button
        type="button"
        onClick={() => !isConfigured && setExpanded(!expanded)}
        disabled={isConfigured}
        className="flex w-full items-center gap-4 p-4 text-left"
      >
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br',
            brand.gradient
          )}
        >
          <BrandIcon className={cn('h-5 w-5', brand.color)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{provider.name}</h4>
            {isConfigured && (
              <Badge variant="success" className="gap-1 text-xs">
                <Check className="h-3 w-3" />
                Connected
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">
            {provider.description}
          </p>
        </div>

        {!isConfigured && (
          <div className="shrink-0">
            <ExternalLink className="text-muted-foreground h-4 w-4" />
          </div>
        )}
      </button>

      {/* Expanded form */}
      {expanded && (
        <form onSubmit={handleSubmit} className="border-border border-t px-4 pt-4 pb-4">
          {error && (
            <div className="bg-danger/5 text-danger mb-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            {provider.fields.map((field) => {
              // Special model selector for AI providers
              if (
                field.name === 'model' &&
                (provider.id === 'openrouter' || provider.id === 'openai')
              ) {
                const modelMode = config._modelMode ?? (config[field.name] ? 'manual' : 'auto');
                const manualModel = config._manualModel ?? config[field.name] ?? '';
                const defaultModel =
                  provider.id === 'openrouter' ? 'openrouter/free' : 'gpt-4o-mini';
                const isAuto = modelMode === 'auto';
                const examples =
                  provider.id === 'openrouter'
                    ? [
                        'google/gemma-3-27b-it:free',
                        'meta-llama/llama-4-maverick:free',
                        'mistralai/mistral-small-3.1-24b-instruct:free',
                      ]
                    : ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'];

                const setMode = (mode: string) => {
                  setConfig((prev) => ({
                    ...prev,
                    _modelMode: mode,
                    _manualModel: prev._manualModel ?? prev.model ?? '',
                    model: mode === 'auto' ? '' : (prev._manualModel ?? prev.model ?? ''),
                  }));
                };

                const setManualModel = (value: string) => {
                  setConfig((prev) => ({ ...prev, _manualModel: value, model: value }));
                };

                return (
                  <div key={field.name} className="space-y-3">
                    <label className="text-sm font-medium">AI Model</label>
                    <div className="space-y-2">
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                          isAuto ? 'border-accent bg-accent/5' : 'border-border hover:bg-surface/50'
                        )}
                      >
                        <input
                          type="radio"
                          name={`model-mode-${provider.id}`}
                          checked={isAuto}
                          onChange={() => setMode('auto')}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium">Automatic (Recommended)</span>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            DerList selects the best available model automatically.
                          </p>
                          <p className="text-accent mt-1 text-xs">
                            Uses:{' '}
                            <code className="bg-surface rounded px-1.5 py-0.5">{defaultModel}</code>
                          </p>
                        </div>
                      </label>
                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                          !isAuto
                            ? 'border-accent bg-accent/5'
                            : 'border-border hover:bg-surface/50'
                        )}
                      >
                        <input
                          type="radio"
                          name={`model-mode-${provider.id}`}
                          checked={!isAuto}
                          onChange={() => setMode('manual')}
                          className="mt-0.5 h-4 w-4"
                        />
                        <div className="flex-1 space-y-2">
                          <span className="text-sm font-medium">Manual</span>
                          <Input
                            type="text"
                            value={manualModel}
                            onChange={(e) => setManualModel(e.target.value)}
                            placeholder={examples[0]}
                            className={cn(
                              'font-mono text-sm',
                              isAuto && 'cursor-not-allowed opacity-50'
                            )}
                            disabled={isAuto}
                          />
                          <p className="text-muted-foreground text-[11px]">
                            Examples: {examples.join(', ')}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                );
              }

              return (
                <div key={field.name} className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Key className="text-muted-foreground h-3.5 w-3.5" />
                    {field.label}
                  </label>
                  <Input
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={config[field.name] ?? ''}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="font-mono text-sm"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting} className="gap-2" size="md">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Connect {provider.name}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                setExpanded(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
