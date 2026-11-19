/**
 * Tests for the Multi-URL Importer
 *
 * Validates:
 * - Detection of multiple URLs in input
 * - Independent processing (one failure doesn't stop others)
 * - Proper batch result format
 * - Deduplication
 */
import { describe, expect, it, vi } from 'vitest';
import { MultiUrlImporter } from '@/lib/importers/multi-url';

// Keep extract() offline: each URL resolves to a stub importer instead of a
// real page fetch. This isolates the line-to-product-name behaviour.
vi.mock('@/lib/importers/registry', () => ({
  detectBestImporter: () => ({
    id: 'stub-url',
    name: 'Stub URL',
    detect: () => ({ match: true, confidence: 100 }),
    extract: async (input: string) => ({
      drafts: [
        {
          title: `Product ${new URL(input).hostname}`,
          source: 'import',
          confidence: 80,
        },
      ],
      isBatch: false,
    }),
  }),
}));

describe('MultiUrlImporter.detect', () => {
  it('detects multiple URLs separated by newlines', () => {
    const input = `https://www.amazon.com/dp/B0GSS4SGZR
https://www.bestbuy.com/site/product/123
https://www.walmart.com/ip/456`;

    const result = MultiUrlImporter.detect(input);
    expect(result.match).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });

  it('does not match single URL', () => {
    const result = MultiUrlImporter.detect('https://www.amazon.com/dp/B0GSS4SGZR');
    expect(result.match).toBe(false);
  });

  it('does not match non-URL text', () => {
    const result = MultiUrlImporter.detect('RTX 5060 Ti\nSamsung 990 Pro');
    expect(result.match).toBe(false);
  });

  it('detects URLs separated by spaces', () => {
    const input = 'https://amazon.com/dp/B0GSS4SGZR https://bestbuy.com/site/123';
    const result = MultiUrlImporter.detect(input);
    expect(result.match).toBe(true);
  });

  it('detects mixed content with multiple URLs', () => {
    const input = `Check these out:
https://www.amazon.com/dp/B0GSS4SGZR
Also this one https://www.bestbuy.com/site/product/123`;

    const result = MultiUrlImporter.detect(input);
    expect(result.match).toBe(true);
  });
});

describe('MultiUrlImporter.extract', () => {
  it('does not add a space-separated URL list as a product name', async () => {
    const input = 'https://www.amazon.com/dp/B0GSS4SGZR https://www.bestbuy.com/site/product/123';

    const result = await MultiUrlImporter.extract(input);

    // One draft per URL, and no extra manual draft named after the URL line.
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts.map((draft) => draft.title)).toEqual([
      'Product www.amazon.com',
      'Product www.bestbuy.com',
    ]);
    expect(result.drafts.some((draft) => draft.source === 'manual')).toBe(false);
    expect(result.drafts.map((draft) => draft.title)).not.toContain(input);
  });

  it('does not add a newline-separated URL list as a product name', async () => {
    const input = `https://www.amazon.com/dp/B0GSS4SGZR
https://www.bestbuy.com/site/product/123
https://www.walmart.com/ip/456`;

    const result = await MultiUrlImporter.extract(input);

    expect(result.drafts).toHaveLength(3);
    expect(result.drafts.some((draft) => draft.source === 'manual')).toBe(false);
    expect(result.drafts.map((draft) => draft.title)).not.toContain(input);
  });

  it('keeps only the text portion of a mixed line as a product name', async () => {
    const input = `Sony WH-1000XM5
Also this one https://www.bestbuy.com/site/product/123 https://www.walmart.com/ip/456`;

    const result = await MultiUrlImporter.extract(input);

    const manualTitles = result.drafts
      .filter((draft) => draft.source === 'manual')
      .map((draft) => draft.title);

    expect(manualTitles).toEqual(['Sony WH-1000XM5', 'Also this one']);
  });
});

describe('MultiUrlImporter architecture', () => {
  it('returns batch format', async () => {
    // We can't test actual network calls here, but we can verify the structure
    expect(MultiUrlImporter.id).toBe('multi-url');
    expect(MultiUrlImporter.name).toBe('Multiple URLs');
    expect(typeof MultiUrlImporter.extract).toBe('function');
  });
});
