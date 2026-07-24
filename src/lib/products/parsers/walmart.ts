import type { ExtractionResult, RetailerParser } from '../engine/types';

export const walmartParser: RetailerParser = {
  name: 'Walmart',
  domains: ['walmart.com', 'walmart.ca'],
  extract(html: string, _url: string): ExtractionResult {
    const result: ExtractionResult = {
      title: null, description: null, price: null, currency: null,
      image: null, gallery: [], brand: null, sku: null, mpn: null,
      gtin: null, inStock: null, availability: null, confidence: 0, source: 'walmart-parser',
    };

    // Try __NEXT_DATA__ for Walmart's React-rendered data
    const nextDataMatch = html.match(/id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const data = JSON.parse(nextDataMatch[1]);
        const product = data?.props?.pageProps?.initialData?.data?.product
          ?? data?.props?.pageProps?.initialProps?.data?.product;
        if (product) {
          result.title = product.name ?? null;
          const priceInfo = product.priceInfo?.currentPrice ?? product.priceInfo?.priceRange?.minPrice;
          if (priceInfo) { result.price = typeof priceInfo.price === 'number' ? priceInfo.price : parseFloat(priceInfo.price); result.currency = priceInfo.currencyCode ?? 'USD'; }
          result.image = product.imageInfo?.thumbnailUrl ?? product.imageInfo?.allImages?.[0]?.url ?? null;
          result.brand = product.brand ?? null;
          const avail = product.availabilityStatus ?? product.fulfillment?.availabilityStatus;
          if (avail) { result.inStock = avail.toLowerCase().includes('in_stock') || avail.toLowerCase().includes('available'); }
        }
      } catch { /* parse error */ }
    }

    // Fallback: itemprop="price"
    if (!result.price) {
      const priceMatch = html.match(/itemprop=["']price["'][^>]*content=["']([0-9.]+)["']/i);
      if (priceMatch) { result.price = parseFloat(priceMatch[1]); result.currency = 'USD'; }
    }

    // Fallback: title
    if (!result.title) {
      const titleMatch = html.match(/<h1[^>]*itemprop=["']name["'][^>]*>([\s\S]*?)<\/h1>/i)
        ?? html.match(/<h1[^>]*id=["']main-title["'][^>]*>([\s\S]*?)<\/h1>/i);
      if (titleMatch) result.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    let conf = 0;
    if (result.title) conf += 25;
    if (result.price) conf += 35;
    if (result.image) conf += 20;
    if (result.brand) conf += 10;
    if (result.inStock !== null) conf += 10;
    result.confidence = conf;
    return result;
  },
};
