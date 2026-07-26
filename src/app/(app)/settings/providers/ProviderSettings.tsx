'use client';

/**
 * ProviderSettings — Client component for managing provider configurations.
 *
 * Three tabs: AI, Shopping, Price.
 * Each tab shows configured providers + "Add Provider" form.
 * One form component handles all provider types.
 */
import { useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle,
  DollarSign,
  Loader2,
  Plus,
  Power,
  ShoppingCart,
  Trash2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

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
  fields: { name: string; label: string; type: string; placeholder?: string }[];
}

// Static provider definitions (matches ProviderSettingsService.AVAILABLE_PROVIDERS)
const AVAILABLE: AvailableProvider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'AI',
    description: 'Access to 100+ AI models including GPT-4, Claude, Llama. Free tier available.',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-or-...' },
      {
        name: 'model',
        label: 'Default Model (optional)',
        type: 'text',
        placeholder: 'meta-llama/llama-3.1-8b-instruct:free',
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'AI',
    description: 'GPT-4o, GPT-4o-mini for chat and product identification.',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' },
      {
        name: 'model',
        label: 'Default Model (optional)',
        type: 'text',
        placeholder: 'gpt-4o-mini',
      },
    ],
  },
  {
    id: 'serpapi',
    name: 'SerpAPI',
    category: 'SHOPPING_SEARCH',
    description: 'Google Shopping search for product discovery and price comparison.',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Your SerpAPI key' },
    ],
  },
  {
    id: 'keepa',
    name: 'Keepa',
    category: 'PRICE',
    description: 'Amazon price history and price drop alerts.',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Your Keepa API key' },
    ],
  },
];

type TabId = 'AI' | 'SHOPPING_SEARCH' | 'PRICE';

const TABS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: 'AI', label: 'AI', icon: Bot },
  { id: 'SHOPPING_SEARCH', label: 'Shopping', icon: ShoppingCart },
  { id: 'PRICE', label: 'Price', icon: DollarSign },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface ProviderSettingsProps {
  providers: ConfiguredProvider[];
}

export function ProviderSettings({ providers: initialProviders }: ProviderSettingsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('AI');
  const [providers, setProviders] = useState(initialProviders);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; message: string }>
  >({});

  const tabProviders = providers.filter((p) => p.category === activeTab);
  const tabAvailable = AVAILABLE.filter((p) => p.category === activeTab);

  // ─── Actions ───

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this provider? This cannot be undone.')) return;
    setIsDeleting(id);

    try {
      const res = await fetch(`/api/providers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProviders((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      // Silent fail — provider might already be deleted
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
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          success: data.success,
          message: data.message || (data.success ? 'Working' : 'Failed'),
        },
      }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, message: 'Test failed' } }));
    } finally {
      setIsTesting(null);
    }
  };

  const handleAdd = async (providerId: string, config: Record<string, string>) => {
    const providerDef = AVAILABLE.find((p) => p.id === providerId);
    if (!providerDef) return;

    try {
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
        setShowAddForm(false);
      }
    } catch {
      // Error handled in form
    }
  };

  // ─── Render ───

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-border flex border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setShowAddForm(false);
            }}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tabProviders.length > 0 && activeTab === tab.id && (
              <span className="bg-accent/10 text-accent ml-1 rounded-full px-1.5 py-0.5 text-xs">
                {tabProviders.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Configured Providers */}
      {tabProviders.length > 0 ? (
        <div className="space-y-3">
          {tabProviders.map((provider) => (
            <Card key={provider.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full',
                      provider.lastStatus === 'HEALTHY'
                        ? 'bg-green-500'
                        : provider.lastStatus === 'UNHEALTHY'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                    )}
                  />
                  <div>
                    <p className="font-medium">{provider.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {provider.providerId} · Priority {provider.priority}
                      {provider.isDefault && ' · Default'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Test result */}
                  {testResults[provider.id] && (
                    <span
                      className={cn(
                        'rounded px-2 py-1 text-xs',
                        testResults[provider.id].success
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      )}
                    >
                      {testResults[provider.id].message}
                    </span>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTest(provider.id)}
                    disabled={isTesting === provider.id}
                  >
                    {isTesting === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(provider.id)}
                    disabled={isDeleting === provider.id}
                    className="text-danger hover:text-danger"
                  >
                    {isDeleting === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6">
          <div className="space-y-2 text-center">
            <p className="text-muted-foreground">
              No {TABS.find((t) => t.id === activeTab)?.label.toLowerCase()} providers configured.
            </p>
            <p className="text-muted-foreground text-sm">
              Add a provider to enable{' '}
              {activeTab === 'AI'
                ? 'AI features like product identification and chat'
                : activeTab === 'SHOPPING_SEARCH'
                  ? 'product search and price comparison'
                  : 'price tracking and alerts'}
              .
            </p>
          </div>
        </Card>
      )}

      {/* Add Provider */}
      {!showAddForm ? (
        <Button
          variant="secondary"
          size="sm"
          className="gap-2"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-4 w-4" />
          Add {TABS.find((t) => t.id === activeTab)?.label} Provider
        </Button>
      ) : (
        <Card className="p-6">
          <h3 className="mb-4 font-medium">Add Provider</h3>
          <div className="space-y-4">
            {tabAvailable.map((available) => (
              <AddProviderForm
                key={available.id}
                provider={available}
                onAdd={handleAdd}
                onCancel={() => setShowAddForm(false)}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Provider Form
// ─────────────────────────────────────────────────────────────────────────────

function AddProviderForm({
  provider,
  onAdd,
  onCancel,
}: {
  provider: AvailableProvider;
  onAdd: (providerId: string, config: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required field (apiKey)
    if (!config.apiKey?.trim()) {
      setError('API Key is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onAdd(provider.id, config);
    } catch {
      setError('Failed to add provider.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
      <div>
        <h4 className="font-medium">{provider.name}</h4>
        <p className="text-muted-foreground text-xs">{provider.description}</p>
      </div>

      {error && (
        <div className="text-danger flex items-center gap-2 text-sm">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {provider.fields.map((field) => (
        <div key={field.name} className="flex flex-col gap-1">
          <label className="text-sm font-medium">{field.label}</label>
          <Input
            type={field.type === 'password' ? 'password' : 'text'}
            value={config[field.name] ?? ''}
            onChange={(e) => setConfig((prev) => ({ ...prev, [field.name]: e.target.value }))}
            placeholder={field.placeholder}
          />
        </div>
      ))}

      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm" disabled={isSubmitting} className="gap-2">
          {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Add {provider.name}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
