/**
 * Microdata Extractor — extracts from itemprop attributes.
 * Confidence 85-90 when found.
 */
import type { ExtractionResult } from '../engine/types';

export function extractFromMicrodata(html: string): ExtractionResult {
  const result: ExtractionResult = {
    title: null, description: null, price: null, currency: null,
    image: null, gallery: [], brand: null, sku: null, mpn: null,
    gtin: null, inStock: null, availability: null, confidence: 0, source: 'microdata',
  };

  result.title = extractItemprop(html, 'name');
  result.description = extractItemprop(html, 'description');
  result.brand = extractItemprop(html, 'brand');
  result.sku = extractItemprop(html, 'sku');
  result.gtin = extractItemprop(html, 'gtin13') ?? extractItemprop(html, 'gtin');

  const priceStr = extractItemprop(html, 'price');
  if (priceStr) { const p = parseFloat(priceStr.replace(/[^0-9.]/g, '')); if (!isNaN(p) && p > 0) result.price = p; }
  result.currency = extractItemprop(html, 'priceCurrency');

  const imgMatch = html.match(/itemprop=["']image["'][^>]*(?:content|src|href)=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1].startsWith('http')) result.image = imgMatch[1];

  const avail = extractItemprop(html, 'availability');
  if (avail) { result.availability = avail; result.inStock = avail.toLowerCase().includes('instock'); }

  let conf = 0;
  if (result.title) conf += 25;
  if (result.price) conf += 35;
  if (result.image) conf += 15;
  if (result.brand) conf += 10;
  if (result.inStock !== null) conf += 5;
  result.confidence = Math.min(conf, 90);

  return result;
}

function extractItemprop(html: string, prop: string): string | null {
  const r1 = new RegExp(`itemprop=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i');
  const r2 = new RegExp(`content=["']([^"']*)["'][^>]*itemprop=["']${prop}["']`, 'i');
  const m = html.match(r1) ?? html.match(r2);
  return m ? m[1].trim() || null : null;
}
