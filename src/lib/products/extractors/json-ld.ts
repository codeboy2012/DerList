/**
 * JSON-LD Extractor — extracts product data from schema.org structured data.
 * Highest confidence source (95-100) when available.
 */
import type { ExtractionResult } from '../engine/types';

export function extractFromJsonLd(html: string): ExtractionResult {
  const result: ExtractionResult = {
    title: null, description: null, price: null, currency: null,
    image: null, gallery: [], brand: null, sku: null, mpn: null,
    gtin: null, inStock: null, availability: null, confidence: 0, source: 'json-ld',
  };

  const product = findProductJsonLd(html);
  if (!product) return result;

  result.title = asStr(product.name);
  result.description = asStr(product.description);
  result.brand = extractBrandFromLd(product);
  result.sku = asStr(product.sku);
  result.mpn = asStr(product.mpn);
  result.gtin = asStr(product.gtin13) ?? asStr(product.gtin12) ?? asStr(product.gtin);

  // Images
  const imgs = extractImagesFromLd(product);
  if (imgs.length > 0) { result.image = imgs[0]; result.gallery = imgs.slice(1); }

  // Price from offers
  const offers = product.offers;
  if (offers && typeof offers === 'object') {
    const offerList = Array.isArray(offers) ? offers : [offers];
    for (const o of offerList) {
      if (!o || typeof o !== 'object') continue;
      const offer = o as Record<string, unknown>;
      const p = parseFloat(String(offer.price ?? offer.lowPrice ?? '').replace(/[^0-9.]/g, ''));
      if (!isNaN(p) && p > 0) { result.price = p; result.currency = asStr(offer.priceCurrency); break; }
    }
    // Availability
    for (const o of offerList) {
      if (!o || typeof o !== 'object') continue;
      const offer = o as Record<string, unknown>;
      const avail = asStr(offer.availability);
      if (avail) { result.availability = avail; result.inStock = avail.toLowerCase().includes('instock'); break; }
    }
  }

  // Confidence based on data found
  let conf = 0;
  if (result.title) conf += 25;
  if (result.price) conf += 35;
  if (result.image) conf += 20;
  if (result.brand) conf += 10;
  if (result.inStock !== null) conf += 10;
  result.confidence = Math.min(conf, 100);

  return result;
}

function findProductJsonLd(html: string): Record<string, unknown> | null {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const product = findProductInData(data);
      if (product) return product;
    } catch { /* skip */ }
  }
  return null;
}

function findProductInData(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) { const r = findProductInData(item); if (r) return r; }
    return null;
  }
  if (Array.isArray(data)) { for (const item of data) { const r = findProductInData(item); if (r) return r; } return null; }
  const type = obj['@type'];
  if (typeof type === 'string' && (type === 'Product' || type.includes('Product'))) return obj;
  if (Array.isArray(type) && type.some((t: string) => t === 'Product' || t.includes('Product'))) return obj;
  return null;
}

function extractBrandFromLd(data: Record<string, unknown>): string | null {
  if (typeof data.brand === 'string') return data.brand;
  if (data.brand && typeof data.brand === 'object') return asStr((data.brand as Record<string, unknown>).name);
  if (typeof data.manufacturer === 'string') return data.manufacturer;
  if (data.manufacturer && typeof data.manufacturer === 'object') return asStr((data.manufacturer as Record<string, unknown>).name);
  return null;
}

function extractImagesFromLd(data: Record<string, unknown>): string[] {
  const imgs: string[] = [];
  const img = data.image;
  if (typeof img === 'string' && img.startsWith('http')) imgs.push(img);
  else if (Array.isArray(img)) { for (const i of img) { if (typeof i === 'string' && i.startsWith('http')) imgs.push(i); else if (i && typeof i === 'object') { const u = asStr((i as Record<string,unknown>).url); if (u) imgs.push(u); } } }
  else if (img && typeof img === 'object') { const u = asStr((img as Record<string,unknown>).url) ?? asStr((img as Record<string,unknown>).contentUrl); if (u) imgs.push(u); }
  return imgs;
}

function asStr(v: unknown): string | null { return typeof v === 'string' && v.trim() ? v.trim() : null; }
