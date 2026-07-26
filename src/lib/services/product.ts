/**
 * Product Service
 *
 * Business logic for product operations: search, identify, enrich, save.
 * Combines local database search with external providers.
 *
 * Strategy: Search first, AI second. Never block on AI.
 */

import { ProviderManager } from '@/lib/providers';
import type { Message, SearchResult } from '@/lib/providers/types';
import { ProductRepository, type ProductSearchResult } from '@/lib/repositories';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductDraft {
  title: string;
  description?: string;
  url?: string;
  image?: string;
  brand?: string;
  retailer?: string;
  currentPrice?: number;
  originalPrice?: number;
  currency?: string;
  dealInfo?: string;
  category?: string;
  sku?: string;
  mpn?: string;
  gtin?: string;
  asin?: string;
  upc?: string;
  /** Where this draft came from */
  source: 'search' | 'ai' | 'import' | 'manual';
  /** 0-100 confidence in the data quality */
  confidence: number;
}

export interface SearchResponse {
  /** Local database results */
  local: ProductSearchResult[];
  /** External provider results */
  external: SearchResult[];
  /** Whether AI was used to interpret the query */
  aiUsed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class ProductService {
  constructor(private readonly providers: ProviderManager) {}

  /**
   * Unified search: checks local DB first, then external providers.
   * Returns combined results from both sources.
   */
  async search(query: string, userId: string): Promise<SearchResponse> {
    // 1. Always search local database
    const local = await ProductRepository.search(query, 10);

    // 2. Try external search if available
    let external: SearchResult[] = [];
    try {
      const searchProvider = await this.providers.getSearchProvider(userId);
      if (searchProvider) {
        external = await searchProvider.search(query, { maxResults: 10 });
      }
    } catch {
      // External search failed — that's fine, we still have local results
    }

    return { local, external, aiUsed: false };
  }

  /**
   * Identify a product from ambiguous input.
   * Uses AI to parse the input and returns a ProductDraft.
   *
   * Tries search first. If no results, uses AI extraction.
   */
  async identify(input: string, userId: string): Promise<ProductDraft | null> {
    // Try direct search first
    const searchResults = await this.search(input.trim(), userId);

    // If we have a strong local match, use it
    if (searchResults.local.length > 0) {
      const best = searchResults.local[0];
      return {
        title: best.title,
        brand: best.brand ?? undefined,
        image: best.image ?? undefined,
        currentPrice: best.currentPrice ?? undefined,
        currency: best.currency,
        retailer: best.retailer ?? undefined,
        url: best.canonicalUrl ?? undefined,
        source: 'search',
        confidence: 90,
      };
    }

    // If we have external results, use the best one
    if (searchResults.external.length > 0) {
      const best = searchResults.external[0];
      return {
        title: best.title,
        url: best.url,
        image: best.image ?? undefined,
        currentPrice: best.price ?? undefined,
        currency: best.currency,
        retailer: best.retailer ?? undefined,
        source: 'search',
        confidence: 75,
      };
    }

    // Fall back to AI extraction
    return this.aiIdentify(input, userId);
  }

  /**
   * Use AI to extract product information from text.
   * Returns null if AI is not available or extraction fails.
   */
  async aiIdentify(input: string, userId: string): Promise<ProductDraft | null> {
    const aiProvider = await this.providers.getAIProvider(userId);
    if (!aiProvider) return null;

    const messages: Message[] = [
      {
        role: 'system',
        content: `You are a product identification assistant. Given user input, extract product information and return it as JSON with these fields:
{
  "title": "Product name",
  "brand": "Brand name or null",
  "category": "Product category or null",
  "currentPrice": number or null,
  "currency": "USD",
  "description": "Brief description or null"
}
Only return the JSON object, nothing else.`,
      },
      {
        role: 'user',
        content: input,
      },
    ];

    try {
      const response = await aiProvider.chat(messages, {
        maxTokens: 300,
        temperature: 0.1,
        json: true,
      });

      const parsed = JSON.parse(response.content);

      return {
        title: parsed.title || input.trim(),
        brand: parsed.brand ?? undefined,
        category: parsed.category ?? undefined,
        currentPrice: typeof parsed.currentPrice === 'number' ? parsed.currentPrice : undefined,
        currency: parsed.currency ?? 'USD',
        description: parsed.description ?? undefined,
        source: 'ai',
        confidence: 60,
      };
    } catch {
      // AI failed — return a basic draft with the input as title
      return {
        title: input.trim(),
        source: 'ai',
        confidence: 30,
      };
    }
  }

  /**
   * Enrich a product draft with additional data from providers + AI.
   * Fills in missing fields without overwriting existing data.
   *
   * Steps:
   * 1. Try search providers for price/image/retailer
   * 2. Run AI enrichment for specs, descriptions, sellers, identifiers
   */
  async enrich(draft: ProductDraft, userId: string): Promise<ProductDraft> {
    const enriched = { ...draft };

    // Step 1: Search provider enrichment (price, image, retailer)
    if (!enriched.currentPrice && enriched.title) {
      try {
        const searchProvider = await this.providers.getSearchProvider(userId);
        if (searchProvider) {
          const results = await searchProvider.search(enriched.title, { maxResults: 3 });
          const match = results.find((r) => r.price !== null);
          if (match) {
            enriched.currentPrice ??= match.price ?? undefined;
            enriched.image ??= match.image ?? undefined;
            enriched.retailer ??= match.retailer ?? undefined;
            enriched.url ??= match.url;
            enriched.confidence = Math.max(enriched.confidence, 70);
          }
        }
      } catch {
        // Search enrichment is best-effort
      }
    }

    // Step 2: AI enrichment (best-effort, non-blocking for basic flow)
    try {
      const { EnrichmentService } = await import('./enrichment');
      const enrichmentService = new EnrichmentService(this.providers);
      const aiResult = await enrichmentService.enrichProduct(
        {
          title: enriched.title,
          brand: enriched.brand,
          category: enriched.category,
          description: enriched.description,
          url: enriched.url,
          retailer: enriched.retailer,
          currentPrice: enriched.currentPrice,
          originalPrice: enriched.originalPrice,
          image: enriched.image,
          sku: enriched.sku,
          asin: enriched.asin,
          upc: enriched.upc,
          mpn: enriched.mpn,
        },
        userId
      );

      // Smart merge AI results into draft (only fill empty fields)
      if (aiResult.confidence > 0) {
        enriched.brand ??= aiResult.brand;
        enriched.category ??= aiResult.category || aiResult.suggestedCategory;
        enriched.description ??= aiResult.description;
        enriched.sku ??= aiResult.sku;
        enriched.asin ??= aiResult.asin;
        enriched.upc ??= aiResult.upc;
        enriched.mpn ??= aiResult.mpn;
        if (!enriched.currentPrice && aiResult.currentPrice) {
          enriched.currentPrice = aiResult.currentPrice;
        }
        if (!enriched.originalPrice && aiResult.msrp) {
          enriched.originalPrice = aiResult.msrp;
        }
        if (!enriched.image && aiResult.images && aiResult.images.length > 0) {
          enriched.image = aiResult.images[0];
        }
        // Boost confidence if AI provided good data
        if (aiResult.confidence >= 70) {
          enriched.confidence = Math.max(enriched.confidence, aiResult.confidence);
        }
      }
    } catch {
      // AI enrichment is best-effort — don't fail the whole identify flow
    }

    return enriched;
  }

  /**
   * Save a product draft to the database as a Product record.
   * If the product already exists (by URL), updates it instead.
   */
  async saveAsProduct(draft: ProductDraft): Promise<string> {
    if (draft.url) {
      const product = await ProductRepository.upsertByUrl({
        canonicalUrl: draft.url,
        title: draft.title,
        description: draft.description,
        brand: draft.brand,
        retailer: draft.retailer,
        image: draft.image,
        currentPrice: draft.currentPrice,
        currency: draft.currency,
        sku: draft.sku,
        mpn: draft.mpn,
        gtin: draft.gtin,
        asin: draft.asin,
        upc: draft.upc,
        source: draft.source === 'manual' ? 'MANUAL' : 'IMPORTED',
      });
      return product.id;
    }

    const product = await ProductRepository.create({
      title: draft.title,
      description: draft.description,
      brand: draft.brand,
      retailer: draft.retailer,
      image: draft.image,
      currentPrice: draft.currentPrice,
      currency: draft.currency,
      sku: draft.sku,
      mpn: draft.mpn,
      gtin: draft.gtin,
      asin: draft.asin,
      upc: draft.upc,
      source: draft.source === 'manual' ? 'MANUAL' : 'IMPORTED',
    });
    return product.id;
  }
}
