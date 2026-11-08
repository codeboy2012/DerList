import { describe, expect, it } from 'vitest';
import { IMPLEMENTED_PROVIDER_IDS, isProviderImplemented } from '@/lib/providers/capabilities';
import { AI_PROVIDERS, PRICE_PROVIDERS, SEARCH_PROVIDERS } from '@/lib/providers/registry/catalog';

describe('provider capability registry', () => {
  it('marks factory-backed providers as implemented', () => {
    expect(isProviderImplemented('ai', 'openrouter')).toBe(true);
    expect(isProviderImplemented('ai', 'anthropic')).toBe(true);
    expect(isProviderImplemented('search', 'serpapi')).toBe(true);
    expect(isProviderImplemented('search', 'brave')).toBe(true);
    expect(isProviderImplemented('price', 'keepa')).toBe(true);
  });

  it('does not advertise catalog entries without a factory implementation', () => {
    // Known catalog entries that have no implementation yet.
    expect(isProviderImplemented('ai', 'cohere')).toBe(false);
    expect(isProviderImplemented('ai', 'aws-bedrock')).toBe(false);
    expect(isProviderImplemented('search', 'walmart')).toBe(false);
    expect(isProviderImplemented('price', 'camelcamelcamel')).toBe(false);
  });

  it('has no implemented provider that is missing from the catalog', () => {
    const catalogIds = new Set(
      [...AI_PROVIDERS, ...SEARCH_PROVIDERS, ...PRICE_PROVIDERS].map((entry) => entry.id)
    );

    for (const category of ['ai', 'search', 'price'] as const) {
      for (const id of IMPLEMENTED_PROVIDER_IDS[category]) {
        expect(catalogIds.has(id), `${category}:${id}`).toBe(true);
      }
    }
  });

  it('every implemented catalog entry is exposed by the settings filter', () => {
    const visible = [...AI_PROVIDERS, ...SEARCH_PROVIDERS, ...PRICE_PROVIDERS].filter((entry) =>
      isProviderImplemented(entry.category, entry.id)
    );

    expect(visible.some((entry) => entry.id === 'brave')).toBe(true);
    expect(visible.some((entry) => entry.id === 'cohere')).toBe(false);
  });
});
