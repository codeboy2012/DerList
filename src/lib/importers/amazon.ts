/**
 * Amazon URL Importer
 *
 * Specialized handler for Amazon product URLs.
 * Extracts ASIN from URL, then uses the generic pipeline for data.
 * Higher confidence than generic-url for amazon.com links.
 */

import { importProductFromUrl } from '@/lib/products';
import type { DetectResult, Importer, ImportResult } from './types';

const AMAZON_PATTERN = /^https?:\/\/(www\.)?amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|com\.au|in)/i;
const ASIN_PATTERN = /\/(?:dp|gp\/product|ASIN)\/([A-Z0-9]{10})/i;

export const AmazonImporter: Importer = {
  id: 'amazon',
  name: 'Amazon',

  detect(input: string): DetectResult {
    const trimmed = input.trim();
    if (AMAZON_PATTERN.test(trimmed)) {
      return { match: true, confidence: 90 };
    }
    return { match: false, confidence: 0 };
  },

  async extract(input: string): Promise<ImportResult> {
    const url = input.trim();

    // Extract ASIN if present
    const asinMatch = url.match(ASIN_PATTERN);
    const asin = asinMatch?.[1] ?? undefined;

    // Use the generic extraction pipeline
    const result = await importProductFromUrl(url);

    if (!result.success) {
      // If extraction fails but we have an ASIN, create a minimal draft
      if (asin) {
        return {
          drafts: [
            {
              title: `Amazon Product (${asin})`,
              url,
              asin,
              retailer: 'Amazon',
              source: 'import',
              confidence: 40,
            },
          ],
          isBatch: false,
        };
      }
      return { drafts: [], isBatch: false };
    }

    const data = result.data;

    return {
      drafts: [
        {
          title: data.title,
          description: data.description ?? undefined,
          url: data.canonicalUrl,
          image: data.image ?? undefined,
          brand: data.brand ?? undefined,
          retailer: 'Amazon',
          currentPrice: data.currentPrice ?? undefined,
          currency: data.currency,
          sku: data.sku ?? undefined,
          asin: asin ?? data.gtin ?? undefined,
          source: 'import',
          confidence: Math.max(data.confidence, 80), // Amazon pages are reliable
        },
      ],
      isBatch: false,
    };
  },
};
