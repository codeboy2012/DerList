import type { ExtractionResult, RetailerParser } from '../engine/types';

export const neweggParser: RetailerParser = {
  name: 'Newegg',
  domains: ['newegg.com', 'newegg.ca'],
  extract(html: string, _url: string): ExtractionResult {
    const result: ExtractionResult = {
      title: null, description: null, price: null, currency: null,
      image: null, gallery: [], brand: null, sku: null, mpn: null,
      gtin: null, inStock: null, availability: null, confidence: 0, source: 'newegg-parser',
    };

    // Title
    const titleMatch = html.match(/class=["'][^"']*product-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
    if (titleMatch) result.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

    // Price — price-current with strong tag or dollar sign
    const priceMatch = html.match(/class=["'][^"']*price-current[^"']*["'][^>]*>[\s\S]*?\$([0-9,]+)(?:<sup>\.(\d{2}))?/i);
    if (priceMatch) {
      const whole = priceMatch[1].replace(/,/g, '');
      const fraction = priceMatch[2] ?? '00';
      const p = parseFloat(`${whole}.${fraction}`);
      if (p > 0) { result.price = p; result.currency = 'USD'; }
    }

    // Image
    const imgMatch = html.match(/class=["'][^"']*product-view-img-original[^"']*["'][^>]*src=["']([^"']+)["']/i)
      ?? html.match(/id=["']A2[^"']*["'][^>]*src=["']([^"']+)["']/i);
    if (imgMatch) result.image = imgMatch[1];

    // Brand
    const brandMatch = html.match(/Brand<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    if (brandMatch) result.brand = brandMatch[1].replace(/<[^>]+>/g, '').trim();

    // Item number (SKU)
    const itemMatch = html.match(/Item\s*#?:\s*<span[^>]*>([^<]+)/i)
      ?? html.match(/Item\s*#?:[\s]*([A-Z0-9]+)/i);
    if (itemMatch) result.sku = itemMatch[1].trim();

    let conf = 0;
    if (result.title) conf += 25;
    if (result.price) conf += 35;
    if (result.image) conf += 20;
    if (result.brand) conf += 10;
    result.confidence = conf;
    return result;
  },
};
