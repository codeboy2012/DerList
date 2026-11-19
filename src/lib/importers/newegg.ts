/**
 * Newegg URL Importer
 *
 * Specialized handler for Newegg product URLs.
 */

import { importProductFromUrl } from '@/lib/products';
import { isUrlOnDomain, parseHttpUrl } from '@/lib/security/url';
import type { DetectResult, Importer, ImportResult } from './types';

const NEWEGG_DOMAINS = ['newegg.com', 'newegg.ca'] as const;
const ITEM_PATTERN = /^\/p\/([A-Z0-9-]+)/i;

export const NeweggImporter: Importer = {
  id: 'newegg',
  name: 'Newegg',

  detect(input: string): DetectResult {
    const trimmed = input.trim();
    if (NEWEGG_DOMAINS.some((domain) => isUrlOnDomain(trimmed, domain))) {
      return { match: true, confidence: 90 };
    }
    return { match: false, confidence: 0 };
  },

  async extract(input: string): Promise<ImportResult> {
    const url = input.trim();
    const parsed = parseHttpUrl(url);
    const itemMatch = parsed?.pathname.match(ITEM_PATTERN);
    const itemNumber = itemMatch?.[1] ?? undefined;

    const result = await importProductFromUrl(url);

    if (!result.success) {
      if (itemNumber) {
        return {
          drafts: [
            {
              title: `Newegg Product (${itemNumber})`,
              url,
              sku: itemNumber,
              retailer: 'Newegg',
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
          retailer: 'Newegg',
          currentPrice: data.currentPrice ?? undefined,
          currency: data.currency,
          sku: itemNumber ?? data.sku ?? undefined,
          source: 'import',
          confidence: Math.max(data.confidence, 80),
        },
      ],
      isBatch: false,
    };
  },
};
