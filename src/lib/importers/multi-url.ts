/**
 * Multi-URL Importer
 *
 * Handles input that contains multiple URLs (one per line or separated by whitespace).
 * Each URL is processed independently through the appropriate importer.
 * One failure does NOT stop other URLs from importing.
 *
 * Example input:
 *   https://www.amazon.com/dp/B0GSS4SGZR
 *   https://www.bestbuy.com/site/...
 *   https://www.walmart.com/ip/...
 */

import type { ProductDraft } from '@/lib/services/product';
import { detectBestImporter } from './registry';
import type { DetectResult, Importer, ImportResult } from './types';

const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const MULTI_URL_MIN = 2;

export const MultiUrlImporter: Importer = {
  id: 'multi-url',
  name: 'Multiple URLs',

  detect(input: string): DetectResult {
    const trimmed = input.trim();

    // Find all URLs in the input
    const urls = trimmed.match(URL_PATTERN);
    if (!urls || urls.length < MULTI_URL_MIN) {
      return { match: false, confidence: 0 };
    }

    // Higher confidence when we have multiple distinct URLs
    const uniqueUrls = new Set(urls.map((u) => u.toLowerCase()));
    if (uniqueUrls.size >= MULTI_URL_MIN) {
      return { match: true, confidence: 85 };
    }

    return { match: false, confidence: 0 };
  },

  async extract(input: string): Promise<ImportResult> {
    const trimmed = input.trim();

    // Extract all URLs from the input
    const urls = trimmed.match(URL_PATTERN);
    if (!urls || urls.length === 0) {
      return { drafts: [], isBatch: true };
    }

    // Deduplicate URLs
    const uniqueUrls = [...new Set(urls.map((u) => u.trim()))];

    // Process each URL independently (max 3 concurrent)
    const drafts: ProductDraft[] = [];
    const CONCURRENCY = 3;

    for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY) {
      const batch = uniqueUrls.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((url) => importSingleUrl(url))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          drafts.push(result.value);
        }
      }
    }

    // Also extract non-URL lines as product names
    const lines = trimmed.split('\n');
    for (const line of lines) {
      const cleaned = line.trim();
      if (cleaned && !URL_PATTERN.test(cleaned) && cleaned.length >= 3) {
        drafts.push({
          title: cleaned,
          source: 'manual',
          confidence: 40,
        });
      }
    }
    // Reset global regex lastIndex
    URL_PATTERN.lastIndex = 0;

    return {
      drafts,
      isBatch: true,
      batchName: `${drafts.length} Products`,
      batchMeta: {
        description: `${uniqueUrls.length} URLs processed`,
      },
    };
  },
};

/**
 * Import a single URL using the best matching importer.
 * Returns null on failure (never throws).
 */
async function importSingleUrl(url: string): Promise<ProductDraft | null> {
  try {
    // Find the best importer for this specific URL
    const importer = detectBestImporter(url);
    if (!importer) return null;

    const result = await importer.extract(url);
    if (result.drafts.length > 0) {
      return result.drafts[0];
    }
    return null;
  } catch {
    // Individual URL failures are silently handled — don't break the batch
    return {
      title: url,
      url,
      source: 'import',
      confidence: 10,
    };
  }
}
