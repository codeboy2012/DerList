/**
 * Product Research Service
 *
 * Performs REAL product research before AI enrichment.
 * Pipeline: Collect → Merge → AI Normalize
 *
 * Phase 1: Fetch real data from retailer pages (metadata, JSON-LD, OG tags)
 * Phase 2: Merge data from multiple sources into a unified view
 * Phase 3: Pass to AI for normalization, classification, and advice
 *
 * The AI organizes information — it does NOT invent retailer data or prices.
 */

import { fetchProductPage } from '@/lib/products/fetch';
import { extractMetadata } from '@/lib/products/metadata';
import type { ProviderManager } from '@/lib/providers';
import { EnrichmentService, type EnrichmentInput, type EnrichmentResult } from './enrichment';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ResearchField<T = string> {
  value: T;
  confidence: number;
  source: string;
}

export interface RetailerData {
  name: string;
  url: string;
  price: ResearchField<number> | null;
  salePrice: ResearchField<number> | null;
  availability: ResearchField;
  shipping: string | null;
  image: string | null;
  lastChecked: string;
}

export interface ResearchResult {
  // Identity
  title: ResearchField | null;
  brand: ResearchField | null;
  model: ResearchField | null;
  sku: ResearchField | null;
  upc: ResearchField | null;
  mpn: ResearchField | null;
  asin: ResearchField | null;
  description: ResearchField | null;
  category: ResearchField | null;

  // Pricing summary
  currentPrice: ResearchField<number> | null;
  msrp: ResearchField<number> | null;
  lowestSeen: ResearchField<number> | null;
  highestSeen: ResearchField<number> | null;

  // Availability
  availability: ResearchField | null;

  // Media
  primaryImage: ResearchField | null;
  galleryImages: string[];

  // Retailers
  retailers: RetailerData[];

  // Specifications (from extraction)
  specifications: Array<{ key: string; value: string; unit?: string; source: string }>;

  // AI-enriched content (filled in Phase 3)
  aiEnrichment: EnrichmentResult | null;

  // Meta
  sourcesChecked: string[];
  researchedAt: string;
  cached: boolean;
}

export interface ResearchInput {
  title?: string;
  url?: string;
  urls?: string[];
  brand?: string;
  category?: string;
  sku?: string;
  upc?: string;
  asin?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────────────────────

const researchCache = new Map<string, { result: ResearchResult; cachedAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes for price/availability

function getCacheKey(input: ResearchInput): string {
  return [input.url, input.title, input.sku, input.upc, input.asin]
    .filter(Boolean)
    .join('|')
    .toLowerCase();
}

function getCached(input: ResearchInput): ResearchResult | null {
  const key = getCacheKey(input);
  const entry = researchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    researchCache.delete(key);
    return null;
  }
  return { ...entry.result, cached: true };
}

function setCache(input: ResearchInput, result: ResearchResult): void {
  const key = getCacheKey(input);
  researchCache.set(key, { result, cachedAt: Date.now() });
  // Evict old entries if cache grows too large
  if (researchCache.size > 500) {
    const oldest = [...researchCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0];
    if (oldest) researchCache.delete(oldest[0]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class ProductResearchService {
  private enrichment: EnrichmentService;

  constructor(private readonly providers: ProviderManager) {
    this.enrichment = new EnrichmentService(providers);
  }

  /**
   * Full research pipeline: Collect → Merge → AI
   */
  async research(input: ResearchInput, userId: string): Promise<ResearchResult> {
    // Check cache first
    const cached = getCached(input);
    if (cached) return cached;

    // Phase 1: Collect real data from URLs
    const urls = this.buildUrlList(input);
    const extractions = await this.collectFromUrls(urls);

    // Phase 2: Merge all sources into a unified result
    const merged = this.mergeSources(extractions, input);

    // Phase 3: AI enrichment (using real data as context)
    const enrichmentInput: EnrichmentInput = {
      title: merged.title?.value || input.title || '',
      brand: merged.brand?.value,
      category: merged.category?.value,
      description: merged.description?.value,
      url: input.url,
      retailer: merged.retailers[0]?.name,
      currentPrice: merged.currentPrice?.value,
      originalPrice: merged.msrp?.value,
      image: merged.primaryImage?.value,
      sku: merged.sku?.value,
      asin: merged.asin?.value,
      upc: merged.upc?.value,
      mpn: merged.mpn?.value,
    };

    try {
      merged.aiEnrichment = await this.enrichment.enrichProduct(enrichmentInput, userId);
    } catch {
      merged.aiEnrichment = null;
    }

    // Cache the result
    setCache(input, merged);

    return merged;
  }

  // ─── Phase 1: Collect ───

  private buildUrlList(input: ResearchInput): string[] {
    const urls: string[] = [];
    if (input.url) urls.push(input.url);
    if (input.urls) urls.push(...input.urls);
    return [...new Set(urls)].slice(0, 5); // Max 5 URLs to research
  }

  private async collectFromUrls(urls: string[]): Promise<SourceExtraction[]> {
    const results: SourceExtraction[] = [];

    // Fetch URLs concurrently (max 3 at a time)
    for (let i = 0; i < urls.length; i += 3) {
      const batch = urls.slice(i, i + 3);
      const batchResults = await Promise.allSettled(batch.map((url) => this.extractFromUrl(url)));
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
    }

    return results;
  }

  private async extractFromUrl(url: string): Promise<SourceExtraction | null> {
    try {
      const { html, finalUrl } = await fetchProductPage(url);
      const domain = new URL(finalUrl).hostname.replace('www.', '');
      const retailerName = this.domainToRetailer(domain);
      const metadata = extractMetadata(html, domain);

      return {
        source: retailerName,
        url: finalUrl,
        domain,
        metadata,
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  // ─── Phase 2: Merge ───

  private mergeSources(extractions: SourceExtraction[], input: ResearchInput): ResearchResult {
    const result: ResearchResult = {
      title: null,
      brand: null,
      model: null,
      sku: null,
      upc: null,
      mpn: null,
      asin: null,
      description: null,
      category: null,
      currentPrice: null,
      msrp: null,
      lowestSeen: null,
      highestSeen: null,
      availability: null,
      primaryImage: null,
      galleryImages: [],
      retailers: [],
      specifications: [],
      aiEnrichment: null,
      sourcesChecked: extractions.map((e) => e.source),
      researchedAt: new Date().toISOString(),
      cached: false,
    };

    // Use input data as baseline
    if (input.title) result.title = { value: input.title, confidence: 50, source: 'user' };
    if (input.brand) result.brand = { value: input.brand, confidence: 50, source: 'user' };
    if (input.sku) result.sku = { value: input.sku, confidence: 90, source: 'user' };
    if (input.upc) result.upc = { value: input.upc, confidence: 90, source: 'user' };
    if (input.asin) result.asin = { value: input.asin, confidence: 90, source: 'user' };

    const allPrices: number[] = [];
    const allImages = new Set<string>();

    for (const extraction of extractions) {
      const { metadata, source, url } = extraction;

      // Title: prefer longer/more detailed title (higher confidence from retailer)
      if (metadata.title) {
        const conf = source === 'Manufacturer' ? 95 : 85;
        if (
          !result.title ||
          conf > result.title.confidence ||
          metadata.title.length > result.title.value.length
        ) {
          result.title = { value: metadata.title, confidence: conf, source };
        }
      }

      // Brand
      if (metadata.brand && (!result.brand || result.brand.confidence < 90)) {
        result.brand = { value: metadata.brand, confidence: 95, source };
      }

      // Identifiers
      if (metadata.sku && !result.sku) result.sku = { value: metadata.sku, confidence: 95, source };
      if (metadata.mpn && !result.mpn) result.mpn = { value: metadata.mpn, confidence: 95, source };
      if (metadata.gtin) {
        if (!result.upc) result.upc = { value: metadata.gtin, confidence: 95, source };
      }

      // ASIN from Amazon URL
      if (extraction.domain.includes('amazon') && !result.asin) {
        const asinMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
        if (asinMatch) result.asin = { value: asinMatch[1], confidence: 100, source: 'Amazon' };
      }

      // Description
      if (
        metadata.description &&
        (!result.description || result.description.value.length < metadata.description.length)
      ) {
        result.description = { value: metadata.description, confidence: 85, source };
      }

      // Images
      if (metadata.image) allImages.add(metadata.image);
      if (metadata.gallery) metadata.gallery.forEach((img) => allImages.add(img));

      // Availability
      if (metadata.availability || metadata.inStock !== null) {
        const avail = this.normalizeAvailability(metadata.availability, metadata.inStock);
        if (!result.availability || result.availability.confidence < 90) {
          result.availability = { value: avail, confidence: 90, source };
        }
      }

      // Pricing
      if (metadata.price && metadata.price > 0) {
        allPrices.push(metadata.price);

        // Build retailer entry
        result.retailers.push({
          name: source,
          url,
          price: { value: metadata.price, confidence: 95, source },
          salePrice: null,
          availability: {
            value: this.normalizeAvailability(metadata.availability, metadata.inStock),
            confidence: 85,
            source,
          },
          shipping: null,
          image: metadata.image,
          lastChecked: extraction.fetchedAt,
        });
      }
    }

    // Determine best current price (lowest among retailers)
    if (allPrices.length > 0) {
      const lowest = Math.min(...allPrices);
      const highest = Math.max(...allPrices);
      const lowestSource =
        result.retailers.find((r) => r.price?.value === lowest)?.name || 'Unknown';
      result.currentPrice = { value: lowest, confidence: 95, source: lowestSource };
      result.lowestSeen = { value: lowest, confidence: 95, source: lowestSource };
      result.highestSeen = { value: highest, confidence: 95, source: 'Multiple' };
      // If highest price differs significantly, treat it as MSRP
      if (highest > lowest * 1.1) {
        result.msrp = { value: highest, confidence: 70, source: 'Estimated' };
      }
    }

    // Images
    const imageArray = [...allImages];
    if (imageArray.length > 0) {
      result.primaryImage = {
        value: imageArray[0],
        confidence: 90,
        source: extractions[0]?.source || 'Unknown',
      };
      result.galleryImages = imageArray.slice(1);
    }

    return result;
  }

  // ─── Helpers ───

  private domainToRetailer(domain: string): string {
    const map: Record<string, string> = {
      'amazon.com': 'Amazon',
      'bestbuy.com': 'Best Buy',
      'walmart.com': 'Walmart',
      'newegg.com': 'Newegg',
      'ebay.com': 'eBay',
      'target.com': 'Target',
      'costco.com': 'Costco',
      'homedepot.com': 'Home Depot',
      'lowes.com': "Lowe's",
      'microcenter.com': 'Micro Center',
      'bhphotovideo.com': 'B&H Photo',
      'apple.com': 'Apple',
      'nvidia.com': 'NVIDIA',
      'amd.com': 'AMD',
      'samsung.com': 'Samsung',
      'corsair.com': 'Corsair',
    };
    for (const [key, name] of Object.entries(map)) {
      if (domain.includes(key)) return name;
    }
    // Use capitalized domain as fallback
    return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
  }

  private normalizeAvailability(text: string | null, inStock: boolean | null): string {
    if (inStock === true) return 'In Stock';
    if (inStock === false) return 'Out of Stock';
    if (!text) return 'Unknown';
    const lower = text.toLowerCase();
    if (lower.includes('in stock') || lower.includes('available')) return 'In Stock';
    if (lower.includes('out of stock') || lower.includes('unavailable')) return 'Out of Stock';
    if (lower.includes('preorder') || lower.includes('pre-order')) return 'Preorder';
    if (lower.includes('backorder')) return 'Backordered';
    if (lower.includes('discontinued')) return 'Discontinued';
    if (lower.includes('limited')) return 'Limited Stock';
    return text;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────────────────

interface SourceExtraction {
  source: string;
  url: string;
  domain: string;
  metadata: ReturnType<typeof extractMetadata>;
  fetchedAt: string;
}
