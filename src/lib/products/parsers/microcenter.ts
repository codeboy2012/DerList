import type { ExtractionResult, RetailerParser } from '../engine/types';

export const microcenterParser: RetailerParser = {
  name: 'Micro Center',
  domains: ['microcenter.com'],
  extract(html: string, _url: string): ExtractionResult {
    const result: ExtractionResult = {
      title: null, description: null, price: null, currency: null,
      image: null, gallery: [], brand: null, sku: null, mpn: null,
      gtin: null, inStock: null, availability: null, confidence: 0, source: 'microcenter-parser',
    };

    const titleMatch = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/h1>/i)
      ?? html.match(/<h1[^>]*class=["'][^"']*product-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
    if (titleMatch) result.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

    const priceMatch = html.match(/id=["']pricing["'][\s\S]*?\$([0-9,]+\.?\d*)/i);
    if (priceMatch) { result.price = parseFloat(priceMatch[1].replace(/,/g, '')); result.currency = 'USD'; }

    const imgMatch = html.match(/id=["']product-image-main["'][^>]*src=["']([^"']+)["']/i)
      ?? html.match(/class=["'][^"']*product-image[^"']*["'][^>]*src=["']([^"']+)["']/i);
    if (imgMatch) result.image = imgMatch[1];

    const brandMatch = html.match(/Brand:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    if (brandMatch) result.brand = brandMatch[1].replace(/<[^>]+>/g, '').trim();

    // Stock
    const stockMatch = html.match(/class=["'][^"']*inventoryCnt[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    if (stockMatch) {
      const text = stockMatch[1].toLowerCase();
      result.inStock = text.includes('in stock') || text.includes('sold and shipped');
    }

    let conf = 0;
    if (result.title) conf += 25;
    if (result.price) conf += 35;
    if (result.image) conf += 20;
    if (result.brand) conf += 10;
    result.confidence = conf;
    return result;
  },
};
