/**
 * Keepa Price Provider
 *
 * Implements PriceProvider using the Keepa API.
 * Provides current prices and price history for Amazon products.
 */

import type { PriceIdType, PricePoint, PriceProvider, PriceResult } from './types';

const KEEPA_API_URL = 'https://api.keepa.com';

interface KeepaConfig {
  apiKey: string;
  /** Amazon domain (1=US, 2=UK, 3=DE, 4=FR, 5=JP, 6=CA, 8=IT, 9=ES, 10=IN) */
  domain?: number;
}

export class KeepaProvider implements PriceProvider {
  readonly id = 'keepa';
  readonly name = 'Keepa';

  private readonly apiKey: string;
  private readonly domain: number;

  constructor(config: KeepaConfig) {
    this.apiKey = config.apiKey;
    this.domain = config.domain ?? 1; // US by default
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async getCurrentPrice(productId: string, idType: PriceIdType): Promise<PriceResult | null> {
    if (idType !== 'asin') {
      // Keepa only works with ASINs directly
      // Could look up ASIN by UPC/EAN but that requires additional API call
      return null;
    }

    const params = new URLSearchParams({
      key: this.apiKey,
      domain: String(this.domain),
      asin: productId,
    });

    const response = await fetch(`${KEEPA_API_URL}/product?${params.toString()}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Keepa API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const product = data.products?.[0];

    if (!product) return null;

    // Keepa stores prices in cents, -1 means unavailable
    const amazonPrice = getLatestPrice(product.csv?.[0]); // Amazon price
    const newPrice = getLatestPrice(product.csv?.[1]); // Marketplace new
    // product.csv[2] = Marketplace used (not used currently)

    const bestPrice = amazonPrice ?? newPrice;
    if (bestPrice === null) return null;

    return {
      currentPrice: bestPrice / 100, // Convert from cents
      currency: domainToCurrency(this.domain),
      retailer: amazonPrice !== null ? 'Amazon' : 'Amazon Marketplace',
      url: `https://www.amazon.com/dp/${productId}`,
      inStock: bestPrice > 0,
      lastUpdated: new Date(),
    };
  }

  async getPriceHistory(productId: string, idType: PriceIdType, days = 90): Promise<PricePoint[]> {
    if (idType !== 'asin') return [];

    const params = new URLSearchParams({
      key: this.apiKey,
      domain: String(this.domain),
      asin: productId,
      days: String(days),
    });

    const response = await fetch(`${KEEPA_API_URL}/product?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Keepa API error (${response.status})`);
    }

    const data = await response.json();
    const product = data.products?.[0];

    if (!product?.csv?.[0]) return [];

    // Keepa CSV format: [time1, price1, time2, price2, ...]
    // Time is Keepa minutes (minutes since 2011-01-01)
    const csv = product.csv[0] as number[];
    const points: PricePoint[] = [];
    const currency = domainToCurrency(this.domain);

    for (let i = 0; i < csv.length - 1; i += 2) {
      const keepaMinutes = csv[i];
      const price = csv[i + 1];

      // Skip unavailable prices (-1)
      if (price < 0) continue;

      points.push({
        price: price / 100,
        currency,
        date: keepaMinutesToDate(keepaMinutes),
        retailer: 'Amazon',
      });
    }

    return points;
  }
}

/**
 * Create a Keepa provider from a config object.
 */
export function createKeepaProvider(config: Record<string, unknown>): KeepaProvider | null {
  const apiKey = config.apiKey as string | undefined;
  if (!apiKey) return null;

  return new KeepaProvider({
    apiKey,
    domain: typeof config.domain === 'number' ? config.domain : undefined,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Keepa epoch: 2011-01-01 00:00:00 UTC in milliseconds */
const KEEPA_EPOCH = 1293840000000;

function keepaMinutesToDate(keepaMinutes: number): Date {
  return new Date(KEEPA_EPOCH + keepaMinutes * 60 * 1000);
}

function getLatestPrice(csv: number[] | undefined): number | null {
  if (!csv || csv.length < 2) return null;
  // Last price entry (second-to-last element is time, last is price)
  const price = csv[csv.length - 1];
  return price > 0 ? price : null;
}

function domainToCurrency(domain: number): string {
  const map: Record<number, string> = {
    1: 'USD',
    2: 'GBP',
    3: 'EUR',
    4: 'EUR',
    5: 'JPY',
    6: 'CAD',
    8: 'EUR',
    9: 'EUR',
    10: 'INR',
  };
  return map[domain] ?? 'USD';
}
