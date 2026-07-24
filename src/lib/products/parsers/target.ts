import type { ExtractionResult, RetailerParser } from '../engine/types';

export const targetParser: RetailerParser = {
  name: 'Target',
  domains: ['target.com'],
  extract(html: string, _url: string): ExtractionResult {
    const result: ExtractionResult = {
      title: null, description: null, price: null, currency: null,
      image: null, gallery: [], brand: null, sku: null, mpn: null,
      gtin: null, inStock: null, availability: null, confidence: 0, source: 'target-parser',
    };

    const titleMatch = html.match(/data-test=["']product-title["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
    if (titleMatch) result.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

    const priceMatch = html.match(/data-test=["']product-price["'][^>]*>\s*\$([0-9,]+\.?\d*)/i)
      ?? html.match(/data-test=["']current-price["'][^>]*>\s*\$([0-9,]+\.?\d*)/i);
    if (priceMatch) { result.price = parseFloat(priceMatch[1].replace(/,/g, '')); result.currency = 'USD'; }

    const imgMatch = html.match(/data-test=["']image-gallery-item-0["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i);
    if (imgMatch) result.image = imgMatch[1];

    let conf = 0;
    if (result.title) conf += 25;
    if (result.price) conf += 35;
    if (result.image) conf += 20;
    result.confidence = conf;
    return result;
  },
};
