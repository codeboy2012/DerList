'use client';

/**
 * FeatureRoutingPanel — Choose which provider powers each DerList feature.
 *
 * Supports:
 * - Strategy selection (Auto, Priority, Weighted, Round Robin, Cost Optimized, Fastest, Highest Quality)
 * - Multi-level failover with priority ordering
 * - Capability-based provider filtering
 */
import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, GripVertical, Loader2, Save } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  FEATURE_DEFINITIONS,
  ROUTING_STRATEGIES,
  type IntegrationCategory,
  type RoutingStrategy,
} from '@/lib/providers/registry/integration-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';

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

interface FeatureRoutingPanelProps {
  providers: SerializedProvider[];
  routing: Record<string, string>;
  onBack: () => void;
}

interface FeatureRoutingState {
  providerId: string;
  strategy: RoutingStrategy;
  failover: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function FeatureRoutingPanel({ providers, routing, onBack }: FeatureRoutingPanelProps) {
  const [values, setValues] = useState<Record<string, FeatureRoutingState>>(() => {
    const init: Record<string, FeatureRoutingState> = {};
    for (const f of FEATURE_DEFINITIONS) {
      const saved = routing[f.id];
      init[f.id] = {
        providerId: saved || 'auto',
        strategy: (routing[`${f.id}_strategy`] as RoutingStrategy) || 'auto',
        failover: [],
      };
    }
    return init;
  });
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const getCompatibleProviders = (compatibleCategories: IntegrationCategory[]) => {
    return providers.filter(
      (p) =>
        p.enabled &&
        compatibleCategories.some(
          (cat) => p.category.toLowerCase() === cat || p.category === cat.toUpperCase()
        )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Flatten to format expected by backend
      const flatRouting: Record<string, string> = {};
      for (const [featureId, state] of Object.entries(values)) {
        flatRouting[featureId] = state.providerId;
        flatRouting[`${featureId}_strategy`] = state.strategy;
        if (state.failover.length > 0) {
          flatRouting[`${featureId}_failover`] = state.failover.join(',');
        }
      }

      const res = await fetch('/api/settings/feature-routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routing: flatRouting }),
      });
      const data = await res.json();
      if (data.success) toast.success('Feature routing saved');
      else toast.error(data.error || 'Failed to save');
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const updateFeature = (featureId: string, updates: Partial<FeatureRoutingState>) => {
    setValues((prev) => ({
      ...prev,
      [featureId]: { ...prev[featureId], ...updates },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:bg-surface hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          aria-label="Back to catalog"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Feature Routing</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Choose which provider powers each feature. Configure strategies and failover.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={saving}
          className="gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>

      {/* Feature List */}
      <div className="space-y-2">
        {FEATURE_DEFINITIONS.map((feature) => {
          const compatibleProviders = getCompatibleProviders(feature.compatibleCategories);
          const isExpanded = expandedFeature === feature.id;
          const state = values[feature.id];

          return (
            <div
              key={feature.id}
              className="border-border bg-card hover:border-border-hover rounded-xl border transition-colors"
            >
              <div className="flex items-center gap-4 p-4">
                {/* Feature Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium">{feature.label}</h3>
                    <Badge variant="secondary">{feature.category}</Badge>
                    {feature.requiredCapabilities && feature.requiredCapabilities.length > 0 && (
                      <span className="text-muted-foreground text-[10px]">
                        needs: {feature.requiredCapabilities.join(', ')}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">{feature.description}</p>
                </div>

                {/* Provider + Strategy */}
                <div className="flex items-center gap-2">
                  <Select
                    value={state.providerId}
                    onChange={(e) => updateFeature(feature.id, { providerId: e.target.value })}
                    className="w-40"
                    aria-label={`Provider for ${feature.label}`}
                  >
                    <option value="auto">Auto (Recommended)</option>
                    {compatibleProviders.map((p) => (
                      <option key={p.id} value={p.providerId}>
                        {p.name}
                      </option>
                    ))}
                  </Select>

                  <button
                    type="button"
                    onClick={() => setExpandedFeature(isExpanded ? null : feature.id)}
                    className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                    title="Strategy & Failover"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded: Strategy + Failover */}
              {isExpanded && (
                <div className="border-border space-y-3 border-t px-4 py-3">
                  {/* Strategy Selection */}
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-xs font-medium">
                      Routing Strategy
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {ROUTING_STRATEGIES.map((strategy) => (
                        <button
                          key={strategy.id}
                          type="button"
                          onClick={() => updateFeature(feature.id, { strategy: strategy.id })}
                          className={cn(
                            'rounded-lg border px-2.5 py-2 text-left transition-all',
                            state.strategy === strategy.id
                              ? 'border-accent bg-accent/5 ring-accent/20 ring-1'
                              : 'border-border hover:border-border-hover'
                          )}
                        >
                          <p className="truncate text-xs font-medium">{strategy.label}</p>
                        </button>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-[10px]">
                      {ROUTING_STRATEGIES.find((s) => s.id === state.strategy)?.description}
                    </p>
                  </div>

                  {/* Failover Priority */}
                  {compatibleProviders.length > 1 && (
                    <div className="space-y-1.5">
                      <label className="text-muted-foreground text-xs font-medium">
                        Failover Priority
                      </label>
                      <div className="space-y-1">
                        {compatibleProviders
                          .sort((a, b) => a.priority - b.priority)
                          .map((p, idx) => (
                            <div
                              key={p.id}
                              className="bg-surface flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                            >
                              <GripVertical className="text-muted h-3.5 w-3.5 cursor-grab" />
                              <span className="bg-accent/10 text-accent flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold">
                                {idx + 1}
                              </span>
                              <span className="flex-1 truncate text-xs">{p.name}</span>
                              <span
                                className={cn(
                                  'h-2 w-2 rounded-full',
                                  p.lastStatus === 'HEALTHY'
                                    ? 'bg-success'
                                    : p.lastStatus === 'DEGRADED'
                                      ? 'bg-warning'
                                      : 'bg-muted'
                                )}
                              />
                            </div>
                          ))}
                      </div>
                      <p className="text-muted text-[10px]">
                        If the primary fails, automatically falls back to the next.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
