/**
 * Product Import — URL Extraction Pipeline
 *
 * Imports product data from URLs by fetching page HTML and extracting
 * structured metadata (JSON-LD, Open Graph, HTML parsers).
 */

import { prisma } from '@/lib/prisma';
import { runExtractionPipeline } from './engine';
import { fetchProductPage } from './fetch';
import { extractDomain, getRetailerName, normalizeUrl } from './normalize';

export type { PipelineResult } from './engine';
export type { PriceCandidate, PriceResult } from './price';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportedProductData {
  canonicalUrl: string;
  normalizedUrl: string;
  domain: string | null;
  retailer: string | null;
  title: string;
  description: string | null;
  brand: string | null;
  sku: string | null;
  mpn: string | null;
  gtin: string | null;
  image: string | null;
  gallery: string[];
  currentPrice: number | null;
  currency: string;
  inStock: boolean | null;
  availability: string | null;
  confidence: number;
  priceSource: string;
  priceCandidates: Array<{
    method: string;
    price: number;
    currency: string | null;
    confidence: number;
    reason: string;
  }>;
  needsReview: boolean;
}

export interface ImportResult {
  success: true;
  data: ImportedProductData;
}

export interface ImportError {
  success: false;
  error: string;
}

export type ImportOutcome = ImportResult | ImportError;

// ─────────────────────────────────────────────────────────────────────────────
// Main import function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Import product data from a URL.
 *
 * Steps:
 * 1. Validate and normalize the URL
 * 2. Check if product was recently fetched (within 5 minutes)
 * 3. Fetch the page HTML (if not cached)
 * 4. Extract metadata (JSON-LD, OG, Twitter, HTML fallback)
 * 5. Return structured product data
 */
export async function importProductFromUrl(rawUrl: string): Promise<ImportOutcome> {
  // 1. Normalize URL
  const normalizedUrl = normalizeUrl(rawUrl);
  if (!normalizedUrl) {
    return { success: false, error: 'Invalid or unsupported URL.' };
  }

  const domain = extractDomain(normalizedUrl);

  // 2. Check recently-fetched cache (within last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const cached = await prisma.product.findFirst({
    where: {
      canonicalUrl: normalizedUrl,
      lastFetchedAt: { gte: fiveMinutesAgo },
    },
  });

  if (cached) {
    return {
      success: true,
      data: {
        canonicalUrl: normalizedUrl,
        normalizedUrl,
        domain,
        retailer: cached.retailer ?? getRetailerName(domain),
        title: cached.title,
        description: cached.description,
        brand: cached.brand,
        sku: cached.sku,
        mpn: cached.mpn,
        gtin: cached.gtin,
        image: cached.image,
        gallery: cached.gallery ? JSON.parse(cached.gallery) : [],
        currentPrice: cached.currentPrice ? Number(cached.currentPrice) : null,
        currency: cached.currency,
        inStock: cached.inStock,
        availability: cached.availability,
        confidence: cached.avgConfidence ?? 80,
        priceSource: cached.lastExtractionMethod ?? 'cache',
        priceCandidates: [],
        needsReview: false,
      },
    };
  }

  // 3. Fetch the page
  let fetchResult: { html: string; finalUrl: string; status: number };
  try {
    fetchResult = await fetchProductPage(normalizedUrl);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch the product page.',
    };
  }

  // 4. Extract metadata
  const extraction = await runExtractionPipeline({
    html: fetchResult.html,
    url: normalizedUrl,
    domain,
  });

  const retailer = extraction.retailer ?? getRetailerName(domain);

  return {
    success: true,
    data: {
      canonicalUrl: normalizedUrl,
      normalizedUrl,
      domain,
      retailer,
      title: extraction.title ?? 'Unknown Product',
      description: extraction.description ?? null,
      brand: extraction.brand ?? null,
      sku: extraction.sku ?? null,
      mpn: extraction.mpn ?? null,
      gtin: extraction.gtin ?? null,
      image: extraction.image ?? null,
      gallery: extraction.gallery ?? [],
      currentPrice: extraction.price,
      currency: extraction.currency ?? 'USD',
      inStock: extraction.inStock ?? null,
      availability: extraction.availability ?? null,
      confidence: extraction.confidence ?? 50,
      priceSource: extraction.priceSource ?? 'unknown',
      priceCandidates: extraction.priceCandidates ?? [],
      needsReview: extraction.needsReview ?? extraction.confidence < 70,
    },
  };
}
