/**
 * OpenGraph Extractor — extracts from og: meta tags.
 * Confidence 75-80.
 */
import type { ExtractionResult } from '../engine/types';

export function extractFromOpenGraph(html: string): ExtractionResult {
  const result: ExtractionResult = {
    title: null, description: null, price: null, currency: null,
    image: null, gallery: [], brand: null, sku: null, mpn: null,
    gtin: null, inStock: null, availability: null, confidence: 0, source: 'opengraph',
  };

  const tags = parseOgTags(html);
  result.title = tags['og:title'] ?? null;
  result.description = tags['og:description'] ?? null;
  result.image = tags['og:image'] ?? null;

  const priceStr = tags['og:price:amount'] ?? tags['product:price:amount'];
  if (priceStr) { const p = parseFloat(priceStr.replace(/[^0-9.]/g, '')); if (!isNaN(p) && p > 0) result.price = p; }
  result.currency = tags['og:price:currency'] ?? tags['product:price:currency'] ?? null;

  let conf = 0;
  if (result.title) conf += 25;
  if (result.price) conf += 30;
  if (result.image) conf += 20;
  result.confidence = Math.min(conf, 80);

  return result;
}

function parseOgTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const r1 = /<meta[^>]*property=["'](og:[^"']+|product:[^"']+)["'][^>]*content=["']([^"']*)["'][^>]*\/?>/gi;
  const r2 = /<meta[^>]*content=["']([^"']*)["'][^>]*property=["'](og:[^"']+|product:[^"']+)["'][^>]*\/?>/gi;
  let m;
  while ((m = r1.exec(html)) !== null) tags[m[1]] = m[2];
  while ((m = r2.exec(html)) !== null) tags[m[2]] = m[1];
  return tags;
}
