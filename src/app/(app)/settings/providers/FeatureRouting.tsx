'use client';

/**
 * FeatureRouting — Visual UI for choosing which provider powers each feature.
 */
import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';

const FEATURES = [
  {
    id: 'aiChat',
    label: 'AI Chat',
    description: 'Shopping assistant conversations',
    category: 'AI',
  },
  {
    id: 'aiAutoFill',
    label: 'AI Auto Fill',
    description: 'Product enrichment & research',
    category: 'AI',
  },
  {
    id: 'aiOrganizer',
    label: 'AI Organizer',
    description: 'Wishlist cleanup & categorization',
    category: 'AI',
  },
  {
    id: 'productSearch',
    label: 'Product Research',
    description: 'Web search for product data',
    category: 'SHOPPING_SEARCH',
  },
  {
    id: 'shoppingSearch',
    label: 'Shopping Prices',
    description: 'Retailer price comparison',
    category: 'SHOPPING_SEARCH',
  },
  {
    id: 'imageSearch',
    label: 'Image Search',
    description: 'Product image collection',
    category: 'SHOPPING_SEARCH',
  },
  {
    id: 'priceTracking',
    label: 'Price History',
    description: 'Historical pricing & alerts',
    category: 'PRICE',
  },
  {
    id: 'duplicateDetection',
    label: 'Duplicate Detection',
    description: 'Find duplicate products',
    category: 'AI',
  },
  {
    id: 'productSummaries',
    label: 'Product Summaries',
    description: 'Generate descriptions & SEO',
    category: 'AI',
  },
] as const;

interface FeatureRoutingProps {
  routing: Record<string, string>;
  providers: { id: string; name: string; category: string; enabled: boolean }[];
}

export function FeatureRouting({ routing, providers }: FeatureRoutingProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of FEATURES) {
      init[f.id] = routing[f.id] || '';
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const getProvidersForCategory = (category: string) => {
    // AI features can use AI providers; search features can use search providers
    if (category === 'AI') return providers.filter((p) => p.category === 'AI' && p.enabled);
    if (category === 'SHOPPING_SEARCH')
      return providers.filter(
        (p) => (p.category === 'SHOPPING_SEARCH' || p.category === 'AI') && p.enabled
      );
    if (category === 'PRICE') return providers.filter((p) => p.category === 'PRICE' && p.enabled);
    return providers.filter((p) => p.enabled);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/feature-routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routing: values }),
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

  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Feature Routing</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Choose which provider powers each feature.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const available = getProvidersForCategory(feature.category);
          return (
            <div key={feature.id} className="space-y-1.5">
              <label className="text-sm font-medium">{feature.label}</label>
              <Select
                value={values[feature.id] || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [feature.id]: e.target.value }))}
              >
                <option value="">Auto (Default)</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <p className="text-muted-foreground text-[10px]">{feature.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
