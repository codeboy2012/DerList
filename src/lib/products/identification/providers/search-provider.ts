/**
 * Search-Based Product Identification Provider
 *
 * Uses the configured search provider (SerpAPI, Brave) to find product
 * information by searching for ASIN, product name, or URL.
 *
 * KEY IMPROVEMENT: For Amazon products, performs MULTIPLE searches:
 * 1. "B0GSS4SGZR" (exact ASIN)
 * 2. "B0GSS4SGZR Amazon" (ASIN + retailer)
 * 3. "site:amazon.com B0GSS4SGZR" (site-scoped)
 *
 * Results are ranked by relevance and combined into structured evidence.
 */

import { getProviderManager } from '@/lib/providers';
import type { SearchProvider, SearchResult } from '@/lib/providers/types';
import { sanitizeBrand, sanitizeImage, sanitizePrice, sanitizeTitle } from '../../validation';
import type { IdentificationInput, IdentificationProvider, IdentifiedProduct } from '../types';
import { importLog } from '../logging';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchEvidence {
  title: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  retailer: string | null;
  url: string | null;
  snippet: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** Whether the result URL contains the exact ASIN we searched for */
  matchedAsin: boolean;
  /** Whether the result is from the expected retailer */
  matchedRetailer: boolean;
  /** Which search query found this result */
  searchQuery: string;
  /** Result confidence based on match quality */
  resultConfidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export class SearchIdentificationProvider implements IdentificationProvider {
  readonly id = 'search-provider';
  readonly name = 'Product Search';
  readonly priority = 20;

  canHandle(input: IdentificationInput): boolean {
    return !!(input.asin || input.url || input.rawInput.length >= 3);
  }

  async identify(input: IdentificationInput): Promise<IdentifiedProduct | null> {
    const providers = getProviderManager();

    try {
      const searchProvider = await providers.getSearchProvider(input.userId);
      if (!searchProvider) {
        importLog('SEARCH_SKIPPED', { reason: 'No search provider configured' });
        return null;
      }

      importLog('SEARCH_STARTED', { asin: input.asin, retailer: input.retailer });

      // Build multiple search queries for better coverage
      const queries = this.buildSearchQueries(input);
      if (queries.length === 0) return null;

      // Execute searches with timeout (try multiple queries)
      const evidence = await this.executeMultiSearch(searchProvider, queries, input);

      if (evidence.length === 0) {
        importLog('SEARCH_NO_RESULTS', { queries });
        return null;
      }

      // Select the best evidence
      const best = evidence[0]; // Already sorted by resultConfidence

      importLog('SEARCH_RESULT_FOUND', {
        title: best.title,
        matchedAsin: best.matchedAsin,
        matchedRetailer: best.matchedRetailer,
        confidence: best.resultConfidence,
        query: best.searchQuery,
      });

      // Validate
      const title = sanitizeTitle(best.title);
      if (!title) {
        importLog('SEARCH_RESULT_REJECTED', { reason: 'Invalid title', title: best.title });
        return null;
      }

      const confidence = this.calculateEvidenceConfidence(best, input);

      // Store evidence in the input for downstream providers (AI)
      // This modifies the input object so the AI provider can access search evidence
      (input as any)._searchEvidence = best;

      // Store all valid image URLs from search results for image resolution
      const allSearchImages = evidence
        .map((e) => e.imageUrl)
        .filter((img): img is string => img != null && img.length > 0);
      (input as any)._searchImages = allSearchImages;

      return {
        title,
        brand: sanitizeBrand(best.brand ?? this.extractBrandFromTitle(title), input.retailer) ?? null,
        price: sanitizePrice(best.price, 'search-result', confidence) ?? null,
        currency: best.currency ?? 'USD',
        retailer: input.retailer ?? best.retailer ?? null, // Prefer input retailer (Amazon) over search result retailer
        url: input.url ?? best.url ?? null,
        imageUrl: sanitizeImage(best.imageUrl) ?? null,
        description: best.snippet ?? null,
        asin: input.asin ?? null,
        sku: null,
        mpn: null,
        gtin: null,
        upc: null,
        category: null,
        confidence,
        source: input.asin ? 'asin-search' : 'search-provider',
        evidence: this.buildEvidenceStrings(best),
        needsReview: confidence < 60,
        fieldSources: {
          titleSource: 'search-provider',
          priceSource: best.price != null ? 'search-provider' : undefined,
          brandSource: best.brand ? 'search-provider' : undefined,
          imageSource: best.imageUrl ? 'search-provider' : undefined,
          urlSource: input.url ? 'user-input' : 'search-provider',
        },
      };
    } catch (error) {
      importLog('SEARCH_ERROR', { error: error instanceof Error ? error.message : 'Unknown' });
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-Query Search Strategy
  // ─────────────────────────────────────────────────────────────────────────

  private buildSearchQueries(input: IdentificationInput): string[] {
    const queries: string[] = [];

    if (input.asin && input.retailer?.toLowerCase() === 'amazon') {
      // For Amazon products with ASIN: try multiple search strategies
      queries.push(input.asin);                           // 1. Exact ASIN
      queries.push(`${input.asin} Amazon`);               // 2. ASIN + retailer
      queries.push(`site:amazon.com ${input.asin}`);      // 3. Site-scoped
    } else if (input.asin) {
      // Non-Amazon ASIN/SKU
      queries.push(input.asin);
      if (input.retailer) {
        queries.push(`${input.asin} ${input.retailer}`);
      }
    } else if (input.url && !input.rawInput.startsWith('http')) {
      // Product name input
      queries.push(input.rawInput);
    } else if (input.url) {
      // URL input — extract meaningful parts
      const meaningful = this.extractMeaningfulFromUrl(input.url);
      if (meaningful) queries.push(meaningful);
    } else if (input.rawInput && input.rawInput.length >= 3 && !input.rawInput.startsWith('http')) {
      // Plain text search
      queries.push(input.rawInput);
    }

    return queries;
  }

  private async executeMultiSearch(
    provider: SearchProvider,
    queries: string[],
    input: IdentificationInput,
  ): Promise<SearchEvidence[]> {
    const allEvidence: SearchEvidence[] = [];
    const TIMEOUT_MS = 8000;
    const MAX_QUERIES = 3; // Don't burn too many API calls

    for (let i = 0; i < Math.min(queries.length, MAX_QUERIES); i++) {
      const query = queries[i];

      try {
        const results = await Promise.race([
          provider.search(query, { maxResults: 5 }),
          new Promise<SearchResult[]>((_, reject) =>
            setTimeout(() => reject(new Error('Search timeout')), TIMEOUT_MS)
          ),
        ]);

        if (results && results.length > 0) {
          // Convert results to evidence and score them
          for (const result of results) {
            const evidence = this.resultToEvidence(result, query, input);
            if (evidence.resultConfidence > 0.2) {
              allEvidence.push(evidence);
            }
          }

          // If we found a high-confidence match, stop searching
          const hasHighConfidence = allEvidence.some((e) => e.resultConfidence >= 0.8);
          if (hasHighConfidence) break;
        }
      } catch {
        // Individual query failure doesn't stop other queries
        continue;
      }
    }

    // Sort by confidence descending
    allEvidence.sort((a, b) => b.resultConfidence - a.resultConfidence);

    // Deduplicate by title (keep highest confidence)
    const seen = new Set<string>();
    const deduped: SearchEvidence[] = [];
    for (const ev of allEvidence) {
      const key = ev.title?.toLowerCase().trim() ?? '';
      if (key && !seen.has(key)) {
        seen.add(key);
        deduped.push(ev);
      }
    }

    return deduped;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Result Scoring & Evidence Extraction
  // ─────────────────────────────────────────────────────────────────────────

  private resultToEvidence(
    result: SearchResult,
    query: string,
    input: IdentificationInput,
  ): SearchEvidence {
    // Check if the result URL contains the ASIN
    const matchedAsin = !!(input.asin && result.url && 
      result.url.toUpperCase().includes(input.asin.toUpperCase()));

    // Check if it's from the expected retailer
    const matchedRetailer = !!(input.retailer && result.retailer &&
      result.retailer.toLowerCase().includes(input.retailer.toLowerCase()));

    // Score this result
    let confidence = 0.3; // Base

    if (matchedAsin) confidence += 0.35;
    if (matchedRetailer) confidence += 0.15;
    if (result.price != null && result.price > 0) confidence += 0.08;
    if (result.image) confidence += 0.04;
    if (result.rating != null && result.rating > 0) confidence += 0.05;
    if (result.inStock) confidence += 0.03;

    // Penalize if title looks like garbage
    const titleValid = sanitizeTitle(result.title);
    if (!titleValid) confidence -= 0.4;

    confidence = Math.min(1, Math.max(0, confidence));

    return {
      title: result.title || null,
      brand: result.retailer !== input.retailer
        ? this.extractBrandFromTitle(result.title)
        : null,
      price: result.price,
      currency: result.currency ?? 'USD',
      imageUrl: result.image,
      retailer: result.retailer,
      url: result.url,
      snippet: result.snippet,
      rating: result.rating,
      reviewCount: result.reviewCount,
      matchedAsin,
      matchedRetailer,
      searchQuery: query,
      resultConfidence: confidence,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Confidence Calculation
  // ─────────────────────────────────────────────────────────────────────────

  private calculateEvidenceConfidence(evidence: SearchEvidence, input: IdentificationInput): number {
    let confidence = 30; // Base for any search result

    // Evidence-based scoring per spec
    if (evidence.matchedAsin) confidence += 30;           // Exact ASIN match
    if (evidence.url?.includes('amazon.com') && input.retailer === 'Amazon') {
      confidence += 20;                                   // Exact Amazon URL
    } else if (evidence.matchedRetailer) {
      confidence += 10;
    }
    if (sanitizeTitle(evidence.title)) confidence += 15;   // Verified product title
    if (evidence.brand && sanitizeBrand(evidence.brand, input.retailer)) confidence += 10;
    if (evidence.price != null && evidence.price > 0) confidence += 10; // Verified price
    if (sanitizeImage(evidence.imageUrl)) confidence += 5; // Verified image

    return Math.min(95, confidence);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private buildEvidenceStrings(evidence: SearchEvidence): string[] {
    const strings: string[] = [];
    strings.push(`Search query: "${evidence.searchQuery}"`);
    if (evidence.matchedAsin) strings.push('Exact ASIN match in result URL');
    if (evidence.matchedRetailer) strings.push(`Retailer match: ${evidence.retailer}`);
    if (evidence.price) strings.push(`Price: $${evidence.price}`);
    if (evidence.rating) strings.push(`Rating: ${evidence.rating}/5 (${evidence.reviewCount ?? 0} reviews)`);
    return strings;
  }

  private extractBrandFromTitle(title: string | null): string | null {
    if (!title) return null;
    // Common pattern: "Brand - Product Name" or at beginning of title
    const dashSplit = title.split(/\s[-–—]\s/);
    if (dashSplit.length >= 2 && dashSplit[0].split(' ').length <= 3) {
      return dashSplit[0].trim();
    }
    return null;
  }

  private extractMeaningfulFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname
        .split('/')
        .filter((p) => p.length > 3)
        .filter((p) => !/^(dp|gp|product|item|ip|p|ASIN|aw|d)$/i.test(p))
        .filter((p) => !/^[A-Z0-9]{10}$/i.test(p));

      if (pathParts.length > 0) {
        const slug = pathParts.reduce((a, b) => (a.length > b.length ? a : b));
        return slug.replace(/[-_+]/g, ' ').trim();
      }
    } catch { /* invalid URL */ }
    return null;
  }
}
