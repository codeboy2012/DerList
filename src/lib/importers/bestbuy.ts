/**
 * Best Buy URL Importer
 *
 * Specialized handler for Best Buy product URLs.
 * Extracts SKU from URL, then uses generic pipeline for data.
 */

import { importProductFromUrl } from '@/lib/products';
import type { DetectResult, Importer, ImportResult } from './types';

const BESTBUY_PATTERN = /^https?:\/\/(www\.)?bestbuy\.com/i;
const SKU_PATTERN = /\/(\d{7})\.p/;

export const BestBuyImporter: Importer = {
  id: 'bestbuy',
  name: 'Best Buy',

  detect(input: string): DetectResult {
    const trimmed = input.trim();
    if (BESTBUY_PATTERN.test(trimmed)) {
      return { match: true, confidence: 90 };
    }
    return { match: false, confidence: 0 };
  },

  async extract(input: string): Promise<ImportResult> {
    const url = input.trim();
    const skuMatch = url.match(SKU_PATTERN);
    const sku = skuMatch?.[1] ?? undefined;

    const result = await importProductFromUrl(url);

    if (!result.success) {
      if (sku) {
        return {
          drafts: [
            {
              title: `Best Buy Product (SKU: ${sku})`,
              url,
              sku,
              retailer: 'Best Buy',
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
          retailer: 'Best Buy',
          currentPrice: data.currentPrice ?? undefined,
          currency: data.currency,
          sku: sku ?? data.sku ?? undefined,
          source: 'import',
          confidence: Math.max(data.confidence, 80),
        },
      ],
      isBatch: false,
    };
  },
};
