/**
 * Generic URL Importer
 *
 * Handles any product URL by fetching the page and running the extraction pipeline.
 * Uses JSON-LD, Open Graph, Twitter cards, and HTML heuristics.
 * This is the fallback for URLs not handled by specialized importers.
 */

import { importProductFromUrl } from '@/lib/products';
import type { DetectResult, Importer, ImportResult } from './types';

const URL_PATTERN = /^https?:\/\/.+/i;

export const GenericUrlImporter: Importer = {
  id: 'generic-url',
  name: 'URL Import',

  detect(input: string): DetectResult {
    const trimmed = input.trim();
    // Match any URL — but with lower confidence than specialized importers
    if (URL_PATTERN.test(trimmed)) {
      return { match: true, confidence: 50 };
    }
    return { match: false, confidence: 0 };
  },

  async extract(input: string): Promise<ImportResult> {
    const url = input.trim();
    const result = await importProductFromUrl(url);

    if (!result.success) {
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
          retailer: data.retailer ?? undefined,
          currentPrice: data.currentPrice ?? undefined,
          currency: data.currency,
          sku: data.sku ?? undefined,
          mpn: data.mpn ?? undefined,
          gtin: data.gtin ?? undefined,
          source: 'import',
          confidence: data.confidence,
        },
      ],
      isBatch: false,
    };
  },
};
