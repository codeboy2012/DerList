import type { ExtractionResult, RetailerParser } from '../engine/types';

export const bestbuyParser: RetailerParser = {
  name: 'Best Buy',
  domains: ['bestbuy.com', 'bestbuy.ca'],
  extract(html: string, _url: string): ExtractionResult {
    const result: ExtractionResult = {
      title: null, description: null, price: null, currency: null,
      image: null, gallery: [], brand: null, sku: null, mpn: null,
      gtin: null, inStock: null, availability: null, confidence: 0, source: 'bestbuy-parser',
    };

    // Title
    const titleMatch = html.match(/<h1[^>]*class=["'][^"']*heading-5[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
      ?? html.match(/class=["'][^"']*sku-title[^"']*["'][^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (titleMatch) result.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

    // Price — priceView-hero-price or priceView-customer-price
    const priceMatch = html.match(/class=["'][^"']*priceView-(?:hero|customer)-price[^"']*["'][^>]*>[\s\S]*?<span[^>]*>\s*\$([0-9,]+\.?\d*)/i);
    if (priceMatch) {
      const p = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (p > 0) { result.price = p; result.currency = 'USD'; }
    }

    // Image
    const imgMatch = html.match(/class=["'][^"']*primary-image[^"']*["'][^>]*src=["']([^"']+)["']/i)
      ?? html.match(/data-testid=["']image-gallery-image["'][^>]*src=["']([^"']+)["']/i);
    if (imgMatch) result.image = imgMatch[1];

    // SKU
    const skuMatch = html.match(/SKU:\s*<\/span>\s*<span[^>]*>([^<]+)/i)
      ?? html.match(/sku=["']([^"']+)["']/i);
    if (skuMatch) result.sku = skuMatch[1].trim();

    let conf = 0;
    if (result.title) conf += 25;
    if (result.price) conf += 35;
    if (result.image) conf += 20;
    if (result.sku) conf += 10;
    result.confidence = conf;
    return result;
  },
};
