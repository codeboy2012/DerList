/**
 * SerpAPI Search Provider
 *
 * Implements SearchProvider using SerpAPI's Google Shopping engine.
 * Returns structured product search results with prices, images, and ratings.
 */

import type { SearchOptions, SearchProvider, SearchResult } from './types';

const SERPAPI_BASE_URL = 'https://serpapi.com/search.json';

interface SerpApiConfig {
  apiKey: string;
  /** Search engine: google_shopping, walmart, etc. */
  engine?: string;
  /** Location for localized results */
  location?: string;
  /** Language code */
  language?: string;
}

export class SerpApiProvider implements SearchProvider {
  readonly id = 'serpapi';
  readonly name = 'SerpAPI';

  private readonly apiKey: string;
  private readonly engine: string;
  private readonly location: string | undefined;
  private readonly language: string;

  constructor(config: SerpApiConfig) {
    this.apiKey = config.apiKey;
    this.engine = config.engine ?? 'google_shopping';
    this.location = config.location;
    this.language = config.language ?? 'en';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      engine: this.engine,
      q: query,
      api_key: this.apiKey,
      num: String(Math.min(options?.maxResults ?? 10, 40)),
      hl: this.language,
    });

    if (this.location) {
      params.set('location', this.location);
    }

    if (options?.minPrice) {
      params.set('tbs', `mr:1,price:1,ppr_min:${options.minPrice}`);
    }
    if (options?.maxPrice) {
      const existing = params.get('tbs') ?? '';
      const maxPart = `ppr_max:${options.maxPrice}`;
      params.set('tbs', existing ? `${existing},${maxPart}` : `mr:1,price:1,${maxPart}`);
    }

    if (options?.sort === 'price_low') {
      params.set('tbs', (params.get('tbs') ?? '') + ',p_ord:p');
    } else if (options?.sort === 'price_high') {
      params.set('tbs', (params.get('tbs') ?? '') + ',p_ord:pd');
    } else if (options?.sort === 'rating') {
      params.set('tbs', (params.get('tbs') ?? '') + ',p_ord:rv');
    }

    const url = `${SERPAPI_BASE_URL}?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SerpAPI error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const results = data.shopping_results ?? data.organic_results ?? [];

    return results.map((item: Record<string, unknown>): SearchResult => ({
      title: String(item.title ?? ''),
      url: String(item.link ?? item.product_link ?? ''),
      price: parsePrice(item.extracted_price ?? item.price),
      currency: 'USD', // SerpAPI returns in user's locale
      image: (item.thumbnail as string) ?? null,
      retailer: (item.source as string) ?? (item.merchant as string) ?? null,
      rating: typeof item.rating === 'number' ? item.rating : null,
      reviewCount: typeof item.reviews === 'number' ? item.reviews : null,
      snippet: (item.snippet as string) ?? null,
      inStock: item.in_stock !== false,
    }));
  }
}

/**
 * Create a SerpAPI provider from a config object.
 */
export function createSerpApiProvider(config: Record<string, unknown>): SerpApiProvider | null {
  const apiKey = config.apiKey as string | undefined;
  if (!apiKey) return null;

  return new SerpApiProvider({
    apiKey,
    engine: (config.engine as string) ?? undefined,
    location: (config.location as string) ?? undefined,
    language: (config.language as string) ?? undefined,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parsePrice(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}
