/**
 * Brave Search Provider
 *
 * Full integration with Brave Search API for product research.
 * Supports: Web, Images, News, Videos, Rich Results, LLM Context.
 *
 * This is a SEARCH provider, not an AI provider.
 * It gathers factual data that is then sent to the AI for normalization.
 */

const BRAVE_BASE_URL = 'https://api.search.brave.com/res/v1';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BraveConfig {
  apiKey: string;
  maxResults?: number;
  maxSources?: number;
  enableImages?: boolean;
  enableNews?: boolean;
  enableRichResults?: boolean;
}

export interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  source?: string;
}

export interface BraveImageResult {
  url: string;
  thumbnail: string;
  title: string;
  source: string;
  width: number;
  height: number;
}

export interface BraveNewsResult {
  title: string;
  url: string;
  description: string;
  source: string;
  age: string;
}

export interface BraveRichResult {
  title: string;
  description: string;
  url?: string;
  type: string;
  data: Record<string, unknown>;
}

export interface BraveResearchResult {
  webResults: BraveWebResult[];
  images: BraveImageResult[];
  news: BraveNewsResult[];
  richResults: BraveRichResult[];
  manufacturerUrl: string | null;
  retailerUrls: string[];
  documentationUrls: string[];
  sourcesVisited: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export class BraveSearchProvider {
  readonly id = 'brave';
  readonly name = 'Brave Search';
  readonly category = 'search' as const;

  private readonly apiKey: string;
  private readonly maxResults: number;
  private readonly maxSources: number;
  private readonly enableImages: boolean;
  private readonly enableNews: boolean;

  constructor(config: BraveConfig) {
    this.apiKey = config.apiKey;
    this.maxResults = config.maxResults ?? 8;
    this.maxSources = config.maxSources ?? 10;
    this.enableImages = config.enableImages ?? true;
    this.enableNews = config.enableNews ?? false;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Full product research: web search + images + rich results.
   * Returns structured data for the AI to normalize.
   */
  async researchProduct(query: string): Promise<BraveResearchResult> {
    const result: BraveResearchResult = {
      webResults: [],
      images: [],
      news: [],
      richResults: [],
      manufacturerUrl: null,
      retailerUrls: [],
      documentationUrls: [],
      sourcesVisited: 0,
    };

    // Run searches concurrently
    const promises: Promise<void>[] = [
      this.webSearch(query).then((r) => {
        result.webResults = r;
      }),
    ];
    if (this.enableImages) {
      promises.push(
        this.imageSearch(query).then((r) => {
          result.images = r;
        })
      );
    }
    if (this.enableNews) {
      promises.push(
        this.newsSearch(query).then((r) => {
          result.news = r;
        })
      );
    }

    await Promise.allSettled(promises);

    // Classify URLs from web results
    for (const r of result.webResults) {
      result.sourcesVisited++;
      const domain = getDomain(r.url);

      if (isManufacturer(domain, query)) {
        if (!result.manufacturerUrl) result.manufacturerUrl = r.url;
      } else if (isRetailer(domain)) {
        result.retailerUrls.push(r.url);
      } else if (isDocumentation(r.url, r.title)) {
        result.documentationUrls.push(r.url);
      }
    }

    return result;
  }

  /**
   * Web search via Brave.
   */
  async webSearch(query: string): Promise<BraveWebResult[]> {
    const params = new URLSearchParams({
      q: query,
      count: String(this.maxResults),
      text_decorations: 'false',
      search_lang: 'en',
    });

    const data = await this.request(`/web/search?${params}`);

    return ((data?.web?.results ?? []) as Record<string, unknown>[])
      .slice(0, this.maxResults)
      .map((r: Record<string, unknown>) => ({
        title: String(r.title ?? ''),
        url: String(r.url ?? ''),
        description: String(r.description ?? ''),
        age: r.age ? String(r.age) : undefined,
        source: (r.profile as { name?: string })?.name || undefined,
      }));
  }

  /**
   * Image search via Brave.
   */
  async imageSearch(query: string): Promise<BraveImageResult[]> {
    const params = new URLSearchParams({
      q: query,
      count: String(Math.min(this.maxResults, 10)),
      search_lang: 'en',
      safesearch: 'moderate',
    });

    const data = await this.request(`/images/search?${params}`);

    return ((data?.results ?? []) as Record<string, unknown>[])
      .slice(0, 10)
      .map((r: Record<string, unknown>) => ({
        url: String(r.url ?? (r.properties as { url?: string })?.url ?? ''),
        thumbnail: String((r.thumbnail as { src?: string })?.src ?? r.url ?? ''),
        title: String(r.title ?? ''),
        source: String(r.source ?? ''),
        width: Number((r.properties as { width?: number })?.width ?? 0),
        height: Number((r.properties as { height?: number })?.height ?? 0),
      }));
  }

  /**
   * News search via Brave.
   */
  async newsSearch(query: string): Promise<BraveNewsResult[]> {
    const params = new URLSearchParams({
      q: query,
      count: String(5),
      search_lang: 'en',
    });

    const data = await this.request(`/news/search?${params}`);

    return ((data?.results ?? []) as Record<string, unknown>[])
      .slice(0, 5)
      .map((r: Record<string, unknown>) => ({
        title: String(r.title ?? ''),
        url: String(r.url ?? ''),
        description: String(r.description ?? ''),
        source: String((r.meta_url as { hostname?: string })?.hostname ?? ''),
        age: String(r.age ?? ''),
      }));
  }

  /**
   * Build AI research context from Brave results.
   * This is what gets sent to the LLM alongside the product data.
   */
  buildResearchContext(result: BraveResearchResult): string {
    const parts: string[] = [];

    if (result.manufacturerUrl) {
      parts.push(`Manufacturer: ${result.manufacturerUrl}`);
    }

    if (result.retailerUrls.length > 0) {
      parts.push(`Retailers: ${result.retailerUrls.slice(0, 5).join(', ')}`);
    }

    if (result.webResults.length > 0) {
      parts.push('Web Results:');
      for (const r of result.webResults.slice(0, this.maxSources)) {
        parts.push(`- ${r.title}: ${r.description.slice(0, 150)}`);
      }
    }

    if (result.images.length > 0) {
      parts.push(`Images found: ${result.images.length}`);
      parts.push(
        `Image URLs: ${result.images
          .slice(0, 5)
          .map((i) => i.url)
          .join(', ')}`
      );
    }

    return parts.join('\n');
  }

  // ─── Private ───

  private async request(
    path: string
  ): Promise<Record<string, unknown> & { web?: { results?: unknown[] }; results?: unknown[] }> {
    const response = await fetch(`${BRAVE_BASE_URL}${path}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error (${response.status})`);
    }

    return response.json();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// URL Classification Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

const RETAILER_DOMAINS = new Set([
  'amazon.com',
  'bestbuy.com',
  'walmart.com',
  'newegg.com',
  'ebay.com',
  'target.com',
  'costco.com',
  'bhphotovideo.com',
  'microcenter.com',
  'adorama.com',
  'staples.com',
  'homedepot.com',
  'lowes.com',
]);

function isRetailer(domain: string): boolean {
  return RETAILER_DOMAINS.has(domain) || domain.includes('shop') || domain.includes('store');
}

function isManufacturer(domain: string, query: string): boolean {
  const brand = query.split(' ')[0]?.toLowerCase() ?? '';
  return domain.includes(brand) && !isRetailer(domain);
}

function isDocumentation(url: string, title: string): boolean {
  const lower = (url + title).toLowerCase();
  return (
    lower.includes('spec') ||
    lower.includes('manual') ||
    lower.includes('datasheet') ||
    lower.includes('documentation')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createBraveSearchProvider(
  config: Record<string, unknown>
): BraveSearchProvider | null {
  const apiKey = config.apiKey as string | undefined;
  if (!apiKey) return null;
  return new BraveSearchProvider({
    apiKey,
    maxResults: (config.maxResults as number) ?? 8,
    maxSources: (config.maxSources as number) ?? 10,
    enableImages: (config.enableImages as boolean) ?? true,
    enableNews: (config.enableNews as boolean) ?? false,
  });
}
