/**
 * Amazon URL Importer
 *
 * Specialized handler for Amazon product URLs.
 * Extracts ASIN from URL, then uses a multi-step fallback pipeline:
 *
 * 1. Direct page extraction (JSON-LD, HTML parsing)
 * 2. ASIN-based search fallback (if extraction fails or produces garbage)
 * 3. Returns a minimal draft with ASIN for downstream AI identification
 *
 * This importer is resilient to Amazon HTML changes because it does NOT
 * depend solely on scraping — it treats the ASIN as the authoritative
 * product identifier and falls back to search when scraping fails.
 */

import { importProductFromUrl } from '@/lib/products';
import { validateProduct } from '@/lib/products/validation';
import type { DetectResult, Importer, ImportResult } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Amazon URL Patterns
// ─────────────────────────────────────────────────────────────────────────────

/** Matches any Amazon domain (including country-specific TLDs) */
const AMAZON_PATTERN = /^https?:\/\/(www\.|smile\.|m\.)?amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|com\.au|in|com\.br|nl|se|pl|sg|com\.mx|ae|sa|eg|com\.tr)/i;

/** Extracts ASIN from Amazon URL paths */
const ASIN_PATTERNS: RegExp[] = [
  /\/dp\/([A-Z0-9]{10})/i,
  /\/gp\/product\/([A-Z0-9]{10})/i,
  /\/ASIN\/([A-Z0-9]{10})/i,
  /\/product\/([A-Z0-9]{10})/i,
  /\/gp\/aw\/d\/([A-Z0-9]{10})/i, // Mobile URLs
];

/** Extracts ASIN from Amazon short URLs (amzn.to, a.co) */
const SHORT_URL_PATTERN = /^https?:\/\/(amzn\.to|a\.co)\//i;

// ─────────────────────────────────────────────────────────────────────────────
// ASIN Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract ASIN from an Amazon URL.
 * Returns null if no ASIN can be found.
 */
export function extractAsinFromUrl(url: string): string | null {
  for (const pattern of ASIN_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

/**
 * Normalize an Amazon URL to its canonical form.
 * Returns the shortest clean URL for the product.
 */
function normalizeAmazonUrl(url: string, asin: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^(www\.|smile\.|m\.)/, 'www.');
    return `https://${host}/dp/${asin}`;
  } catch {
    return `https://www.amazon.com/dp/${asin}`;
  }
}

/**
 * Detect the Amazon domain's country from the URL for search targeting.
 */
function detectAmazonCountry(url: string): string {
  const match = url.match(/amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|com\.au|in|com\.br|nl|se|pl|sg|com\.mx|ae|sa|eg|com\.tr)/i);
  if (!match) return 'us';
  const tldMap: Record<string, string> = {
    'com': 'us', 'co.uk': 'uk', 'ca': 'ca', 'de': 'de', 'fr': 'fr',
    'it': 'it', 'es': 'es', 'co.jp': 'jp', 'com.au': 'au', 'in': 'in',
    'com.br': 'br', 'nl': 'nl', 'se': 'se', 'pl': 'pl', 'sg': 'sg',
    'com.mx': 'mx', 'ae': 'ae', 'sa': 'sa', 'eg': 'eg', 'com.tr': 'tr',
  };
  return tldMap[match[1].toLowerCase()] ?? 'us';
}

// ─────────────────────────────────────────────────────────────────────────────
// Importer
// ─────────────────────────────────────────────────────────────────────────────

export const AmazonImporter: Importer = {
  id: 'amazon',
  name: 'Amazon',

  detect(input: string): DetectResult {
    const trimmed = input.trim();
    if (AMAZON_PATTERN.test(trimmed) || SHORT_URL_PATTERN.test(trimmed)) {
      return { match: true, confidence: 90 };
    }
    return { match: false, confidence: 0 };
  },

  async extract(input: string): Promise<ImportResult> {
    const url = input.trim();

    // Extract ASIN from URL
    const asin = extractAsinFromUrl(url);
    const canonicalUrl = asin ? normalizeAmazonUrl(url, asin) : url;
    const country = detectAmazonCountry(url);

    // ── Step 1: Try direct page extraction ──
    const directResult = await tryDirectExtraction(canonicalUrl, asin);

    if (directResult) {
      // Validate the extraction result
      const validation = validateProduct({
        title: directResult.title,
        price: directResult.currentPrice,
        brand: directResult.brand,
        image: directResult.image,
        retailer: 'Amazon',
      }, directResult.confidence ?? 80);

      if (validation.isAcceptable && validation.overallConfidence >= 50) {
        // Direct extraction succeeded with valid data
        return {
          drafts: [{
            title: directResult.title,
            description: directResult.description ?? undefined,
            url: canonicalUrl,
            image: directResult.image ?? undefined,
            brand: directResult.brand ?? undefined,
            retailer: 'Amazon',
            currentPrice: directResult.currentPrice ?? undefined,
            currency: directResult.currency ?? 'USD',
            sku: directResult.sku ?? undefined,
            asin: asin ?? undefined,
            source: 'import',
            confidence: validation.overallConfidence,
          }],
          isBatch: false,
        };
      }

      // Direct extraction produced garbage — fall through to search
    }

    // ── Step 2: ASIN search fallback ──
    // If we have an ASIN but direct extraction failed or produced garbage,
    // return a draft that signals the pipeline to use search/AI identification.
    if (asin) {
      return {
        drafts: [{
          title: '', // Empty title signals that identification is needed
          url: canonicalUrl,
          asin,
          retailer: 'Amazon',
          source: 'import',
          confidence: 20, // Low confidence — needs further identification
          // Store metadata for the pipeline to use in search/AI fallback
          _meta: {
            needsIdentification: true,
            asin,
            amazonCountry: country,
            directExtractionFailed: true,
            failureReason: directResult
              ? 'Extraction produced invalid data (generic title or suspect price)'
              : 'Could not extract product data from page',
          },
        } as any], // eslint-disable-line @typescript-eslint/no-explicit-any
        isBatch: false,
      };
    }

    // ── Step 3: No ASIN, no valid extraction — return empty ──
    return {
      drafts: [{
        title: '',
        url: canonicalUrl,
        retailer: 'Amazon',
        source: 'import',
        confidence: 10,
        _meta: {
          needsIdentification: true,
          directExtractionFailed: true,
          failureReason: 'No ASIN found and page extraction failed',
        },
      } as any], // eslint-disable-line @typescript-eslint/no-explicit-any
      isBatch: false,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Direct Extraction Helper
// ─────────────────────────────────────────────────────────────────────────────

interface DirectExtractionResult {
  title: string;
  description: string | null;
  image: string | null;
  brand: string | null;
  currentPrice: number | null;
  currency: string;
  sku: string | null;
  confidence: number;
}

async function tryDirectExtraction(
  url: string,
  asin: string | null,
): Promise<DirectExtractionResult | null> {
  try {
    const result = await importProductFromUrl(url);

    if (!result.success) {
      return null;
    }

    const data = result.data;

    return {
      title: data.title,
      description: data.description,
      image: data.image,
      brand: data.brand,
      currentPrice: data.currentPrice,
      currency: data.currency,
      sku: asin ?? data.sku,
      confidence: data.confidence,
    };
  } catch {
    return null;
  }
}
