/**
 * Product import service — main entry point.
 *
 * Orchestrates: URL validation → normalization → cache check → fetch → metadata extraction.
 * Returns a structured product data object ready for database insertion.
 */

import { prisma } from '@/lib/prisma';

import { fetchProductPage } from './fetch';
import { extractMetadata } from './metadata';
import { extractDomain, getRetailerName, normalizeUrl } from './normalize';

export type { ExtractedMetadata } from './metadata';
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
 *
 * Does NOT interact with the database for writes — that's handled by the server action.
 * DOES read from the database to check the recently-fetched cache.
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
    // Return existing product data without re-fetching
    const data: ImportedProductData = {
      canonicalUrl: cached.canonicalUrl ?? normalizedUrl,
      normalizedUrl: cached.normalizedUrl ?? normalizedUrl.toLowerCase(),
      domain: cached.domain,
      retailer: cached.retailer,
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
    };
    return { success: true, data };
  }

  // 3. Fetch the page
  let html: string;
  let finalUrl: string;
  try {
    const result = await fetchProductPage(normalizedUrl);
    html = result.html;
    finalUrl = result.finalUrl;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch product page.';

    // Provide user-friendly error messages for common failures
    if (message.includes('HTTP 403') || message.includes('HTTP 429')) {
      return {
        success: false,
        error: 'The retailer blocked the request. Please wait a moment and try again.',
      };
    }
    if (message.includes('HTTP 4')) {
      return { success: false, error: `Could not fetch page: ${message}` };
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        error: 'The page took too long to respond. Please try again later.',
      };
    }
    if (message.includes('abort') || message.includes('timeout') || message.includes('timed out')) {
      return {
        success: false,
        error: 'The page took too long to respond. Please try again later.',
      };
    }

    return { success: false, error: `Could not fetch page: ${message}` };
  }

  // 4. Extract metadata (pass domain for retailer-specific price parsing)
  const metadata = extractMetadata(html, domain);

  // Must have at least a title
  if (!metadata.title) {
    return {
      success: false,
      error:
        'Could not identify a product on this page. Make sure the URL points directly to a product.',
    };
  }

  // 5. Build result
  const canonicalUrl = normalizeUrl(finalUrl) ?? normalizedUrl;
  const retailerFromDomain = getRetailerName(domain);

  const data: ImportedProductData = {
    canonicalUrl,
    normalizedUrl: canonicalUrl.toLowerCase(),
    domain,
    retailer: metadata.retailer ?? retailerFromDomain ?? domain,
    title: metadata.title,
    description: metadata.description,
    brand: metadata.brand,
    sku: metadata.sku,
    mpn: metadata.mpn,
    gtin: metadata.gtin,
    image: metadata.image,
    gallery: metadata.gallery,
    currentPrice: metadata.price,
    currency: metadata.currency ?? 'USD',
    inStock: metadata.inStock,
    availability: metadata.availability,
  };

  return { success: true, data };
}
