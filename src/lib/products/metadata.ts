/**
 * Metadata extraction from HTML.
 *
 * Extracts product information from (in priority order):
 * 1. JSON-LD (schema.org Product)
 * 2. OpenGraph meta tags
 * 3. Twitter Card meta tags
 * 4. Product-specific meta tags (product:price, etc.)
 * 5. Standard HTML meta/title
 * 6. HTML content fallbacks (images, price patterns)
 *
 * Priority: JSON-LD > OpenGraph > Twitter > meta > HTML fallback
 */

import { extractBestPrice } from './price';

export interface ExtractedMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  gallery: string[];
  price: number | null;
  currency: string | null;
  brand: string | null;
  sku: string | null;
  mpn: string | null;
  gtin: string | null;
  inStock: boolean | null;
  availability: string | null;
  retailer: string | null;
}

/**
 * Extract product metadata from HTML content.
 *
 * @param html - The raw HTML of the product page
 * @param domain - Optional domain (e.g., "amazon.com") for retailer-specific price parsing
 */
export function extractMetadata(html: string, domain?: string | null): ExtractedMetadata {
  const result: ExtractedMetadata = {
    title: null,
    description: null,
    image: null,
    gallery: [],
    price: null,
    currency: null,
    brand: null,
    sku: null,
    mpn: null,
    gtin: null,
    inStock: null,
    availability: null,
    retailer: null,
  };

  // 1. Extract JSON-LD data (highest priority)
  const jsonLdData = extractJsonLd(html);
  if (jsonLdData) {
    applyJsonLd(result, jsonLdData);
  }

  // 2. Extract OpenGraph tags
  const ogData = extractOpenGraph(html);
  applyOpenGraph(result, ogData);

  // 3. Extract Twitter Card tags
  const twitterData = extractTwitterCard(html);
  applyTwitterCard(result, twitterData);

  // 4. Extract product-specific meta tags
  applyProductMeta(result, html);

  // 5. Fallback to basic meta/title
  if (!result.title) {
    result.title = extractHtmlTitle(html);
  }
  if (!result.description) {
    result.description = extractMetaContent(html, 'description');
  }

  // 6. Image fallbacks — try harder if we still don't have one
  if (!result.image) {
    result.image = extractFallbackImage(html);
  }

  // 7. Price fallbacks — use confidence-based price extraction engine
  if (result.price == null) {
    const priceResult = extractBestPrice(html, domain ?? null);
    if (priceResult) {
      result.price = priceResult.price;
      if (!result.currency) result.currency = priceResult.currency;
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON-LD Extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractJsonLd(html: string): Record<string, unknown> | null {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);

      // Handle @graph arrays
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        const product = data['@graph'].find(
          (item: Record<string, unknown>) => {
            const type = item['@type'];
            if (typeof type === 'string') return type === 'Product' || type.includes('Product');
            if (Array.isArray(type)) return type.some((t: string) => t === 'Product' || t.includes('Product'));
            return false;
          },
        );
        if (product) return product as Record<string, unknown>;
      }

      // Handle arrays at top level
      if (Array.isArray(data)) {
        const product = data.find((item: Record<string, unknown>) => {
          const type = item['@type'];
          if (typeof type === 'string') return type === 'Product' || type.includes('Product');
          return false;
        });
        if (product) return product as Record<string, unknown>;
      }

      // Direct Product type
      const type = data['@type'];
      if (typeof type === 'string' && (type === 'Product' || type.includes('Product'))) {
        return data as Record<string, unknown>;
      }
      if (Array.isArray(type) && type.some((t: string) => t === 'Product' || t.includes('Product'))) {
        return data as Record<string, unknown>;
      }
    } catch {
      // Invalid JSON — skip
    }
  }

  return null;
}

function applyJsonLd(result: ExtractedMetadata, data: Record<string, unknown>): void {
  result.title = asString(data.name) ?? result.title;
  result.description = asString(data.description) ?? result.description;
  result.brand = extractBrand(data) ?? result.brand;
  result.sku = asString(data.sku) ?? result.sku;
  result.mpn = asString(data.mpn) ?? result.mpn;
  result.gtin = asString(data.gtin13) ?? asString(data.gtin12) ?? asString(data.gtin) ?? asString(data.isbn) ?? result.gtin;

  // Image — handle all formats
  const images = extractJsonLdImages(data);
  if (images.length > 0) {
    result.image = images[0];
    if (images.length > 1) {
      result.gallery = images.slice(1);
    }
  }

  // Offers (pricing) — handle single offer, array of offers, AggregateOffer
  extractJsonLdPricing(result, data);
}

function extractJsonLdImages(data: Record<string, unknown>): string[] {
  const images: string[] = [];

  const img = data.image;
  if (typeof img === 'string' && isValidImageUrl(img)) {
    images.push(img);
  } else if (Array.isArray(img)) {
    for (const item of img) {
      if (typeof item === 'string' && isValidImageUrl(item)) {
        images.push(item);
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const url = asString(obj.url) ?? asString(obj.contentUrl) ?? asString(obj['@id']);
        if (url && isValidImageUrl(url)) images.push(url);
      }
    }
  } else if (img && typeof img === 'object') {
    const obj = img as Record<string, unknown>;
    const url = asString(obj.url) ?? asString(obj.contentUrl) ?? asString(obj['@id']);
    if (url && isValidImageUrl(url)) images.push(url);
  }

  return images;
}

function extractJsonLdPricing(result: ExtractedMetadata, data: Record<string, unknown>): void {
  const offers = data.offers;
  if (!offers || typeof offers !== 'object') return;

  // Could be a single Offer, an array, or an AggregateOffer
  const offerList = Array.isArray(offers) ? offers : [offers];

  for (const offerObj of offerList) {
    if (!offerObj || typeof offerObj !== 'object') continue;
    const offer = offerObj as Record<string, unknown>;

    // AggregateOffer contains lowPrice/highPrice
    const priceStr = String(offer.price ?? offer.lowPrice ?? offer.highPrice ?? '');
    const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    if (!isNaN(price) && price > 0 && result.price == null) {
      result.price = price;
    }

    if (!result.currency) {
      result.currency = asString(offer.priceCurrency) ?? null;
    }

    // Availability
    const avail = asString(offer.availability);
    if (avail && result.inStock == null) {
      result.availability = avail;
      const lower = avail.toLowerCase();
      result.inStock = lower.includes('instock') || lower.includes('in_stock');
    }

    // If we got a price, stop looking
    if (result.price != null) break;
  }
}

function extractBrand(data: Record<string, unknown>): string | null {
  if (typeof data.brand === 'string') return data.brand;
  if (data.brand && typeof data.brand === 'object') {
    const brandObj = data.brand as Record<string, unknown>;
    return asString(brandObj.name) ?? null;
  }
  // manufacturer fallback
  if (typeof data.manufacturer === 'string') return data.manufacturer;
  if (data.manufacturer && typeof data.manufacturer === 'object') {
    const mfg = data.manufacturer as Record<string, unknown>;
    return asString(mfg.name) ?? null;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenGraph Extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractOpenGraph(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  // Match both attribute orders
  const regex1 = /<meta[^>]*property=["'](og:[^"']+)["'][^>]*content=["']([^"']*)["'][^>]*\/?>/gi;
  const regex2 = /<meta[^>]*content=["']([^"']*)["'][^>]*property=["'](og:[^"']+)["'][^>]*\/?>/gi;

  let match;
  while ((match = regex1.exec(html)) !== null) tags[match[1]] = match[2];
  while ((match = regex2.exec(html)) !== null) tags[match[2]] = match[1];

  return tags;
}

function applyOpenGraph(result: ExtractedMetadata, og: Record<string, string>): void {
  if (!result.title && og['og:title']) result.title = decodeHtmlEntities(og['og:title']);
  if (!result.description && og['og:description']) result.description = decodeHtmlEntities(og['og:description']);
  if (!result.retailer && og['og:site_name']) result.retailer = decodeHtmlEntities(og['og:site_name']);

  // Image — og:image is very reliable
  if (!result.image && og['og:image']) {
    const img = og['og:image'];
    if (isValidImageUrl(img)) result.image = img;
  }

  // Price from og:price:amount or product:price:amount
  if (result.price == null) {
    const priceStr = og['og:price:amount'] ?? og['product:price:amount'];
    if (priceStr) {
      const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
      if (!isNaN(price) && price > 0) result.price = price;
    }
  }
  if (!result.currency) {
    result.currency = og['og:price:currency'] ?? og['product:price:currency'] ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Twitter Card Extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractTwitterCard(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const regex1 = /<meta[^>]*(?:name|property)=["'](twitter:[^"']+)["'][^>]*content=["']([^"']*)["'][^>]*\/?>/gi;
  const regex2 = /<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["'](twitter:[^"']+)["'][^>]*\/?>/gi;

  let match;
  while ((match = regex1.exec(html)) !== null) tags[match[1]] = match[2];
  while ((match = regex2.exec(html)) !== null) tags[match[2]] = match[1];

  return tags;
}

function applyTwitterCard(result: ExtractedMetadata, tw: Record<string, string>): void {
  if (!result.title && tw['twitter:title']) result.title = decodeHtmlEntities(tw['twitter:title']);
  if (!result.description && tw['twitter:description']) result.description = decodeHtmlEntities(tw['twitter:description']);
  if (!result.image && tw['twitter:image']) {
    const img = tw['twitter:image'];
    if (isValidImageUrl(img)) result.image = img;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Product-specific meta tags
// ─────────────────────────────────────────────────────────────────────────────

function applyProductMeta(result: ExtractedMetadata, html: string): void {
  // product:brand
  if (!result.brand) {
    result.brand = extractMetaProperty(html, 'product:brand') ?? extractMetaProperty(html, 'og:brand') ?? null;
  }
  // product:availability
  if (result.inStock == null) {
    const avail = extractMetaProperty(html, 'product:availability');
    if (avail) {
      result.inStock = avail.toLowerCase().includes('instock') || avail.toLowerCase() === 'in stock';
    }
  }
}

function extractMetaProperty(html: string, property: string): string | null {
  const regex1 = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["'][^>]*/?>`, 'i');
  const regex2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["'][^>]*/?>`, 'i');
  const match = html.match(regex1) ?? html.match(regex2);
  return match ? decodeHtmlEntities(match[1]) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback Image Extraction (when structured data fails)
// ─────────────────────────────────────────────────────────────────────────────

function extractFallbackImage(html: string): string | null {
  // Try meta image tag
  const metaImage = extractMetaContent(html, 'image') ?? extractMetaProperty(html, 'thumbnail');
  if (metaImage && isValidImageUrl(metaImage)) return metaImage;

  // Try link rel="image_src"
  const linkMatch = html.match(/<link[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (linkMatch && isValidImageUrl(linkMatch[1])) return linkMatch[1];

  // Find large product images in HTML (heuristic: look for img tags with product-related attributes)
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const candidates: Array<{ url: string; score: number }> = [];
  let imgMatch;

  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const fullTag = imgMatch[0];
    const url = imgMatch[1];

    if (!isValidImageUrl(url)) continue;
    if (isTrackingPixel(url)) continue;

    let score = 0;

    // Boost for product-related attributes
    if (/product|item|hero|main|primary|feature/i.test(fullTag)) score += 3;
    if (/data-(?:zoom|large|full|high)/i.test(fullTag)) score += 4;
    if (/id=["'][^"']*(?:product|item|main)/i.test(fullTag)) score += 3;
    if (/class=["'][^"']*(?:product|item|hero|gallery)/i.test(fullTag)) score += 2;

    // Boost for larger specified dimensions
    const widthMatch = fullTag.match(/width=["']?(\d+)/i);
    const heightMatch = fullTag.match(/height=["']?(\d+)/i);
    if (widthMatch) {
      const w = parseInt(widthMatch[1], 10);
      if (w >= 300) score += 2;
      if (w >= 500) score += 2;
    }
    if (heightMatch) {
      const h = parseInt(heightMatch[1], 10);
      if (h >= 300) score += 1;
    }

    // Penalize icons, logos, badges
    if (/icon|logo|badge|sprite|avatar|button|arrow|star|rating/i.test(url)) score -= 5;
    if (/1x1|pixel|spacer|blank|transparent/i.test(url)) score -= 10;

    if (score > 0) {
      candidates.push({ url, score });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].url;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Fallbacks
// ─────────────────────────────────────────────────────────────────────────────

function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function extractMetaContent(html: string, name: string): string | null {
  const regex = new RegExp(
    `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*/?>`,
    'i',
  );
  const regex2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["'][^>]*/?>`,
    'i',
  );
  const match = html.match(regex) ?? html.match(regex2);
  return match ? decodeHtmlEntities(match[1]) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

function isValidImageUrl(url: string): boolean {
  if (!url || url.length < 10) return false;
  if (url.startsWith('data:')) return false;
  // Must start with http or //
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
}

function isTrackingPixel(url: string): boolean {
  return /1x1|pixel|spacer|blank|transparent|beacon|track|analytics/i.test(url);
}
