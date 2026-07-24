/**
 * Product import service — main entry point.
 *
 * Orchestrates: URL validation → normalization → fetch → metadata extraction.
 * Returns a structured product data object ready for database insertion.
 */

import { fetchProductPage } from './fetch';
import { extractMetadata } from './metadata';
import { extractDomain, getRetailerName, normalizeUrl } from './normalize';

export type { ExtractedMetadata } from './metadata';

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
 * 2. Fetch the page HTML
 * 3. Extract metadata (JSON-LD, OG, Twitter, HTML fallback)
 * 4. Return structured product data
 *
 * Does NOT interact with the database — that's handled by the server action.
 */
export async function importProductFromUrl(rawUrl: string): Promise<ImportOutcome> {
  // 1. Normalize URL
  const normalizedUrl = normalizeUrl(rawUrl);
  if (!normalizedUrl) {
    return { success: false, error: 'Invalid or unsupported URL.' };
  }

  const domain = extractDomain(normalizedUrl);

  // 2. Fetch the page
  let html: string;
  let finalUrl: string;
  try {
    const result = await fetchProductPage(normalizedUrl);
    html = result.html;
    finalUrl = result.finalUrl;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch product page.';
    return { success: false, error: `Could not fetch page: ${message}` };
  }

  // 3. Extract metadata
  const metadata = extractMetadata(html);

  // Must have at least a title
  if (!metadata.title) {
    return { success: false, error: 'Could not extract product information from this page.' };
  }

  // 4. Build result
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
