/**
 * Amazon Site-Specific Parser
 *
 * Extracts product data from Amazon product pages using buy-box specific selectors.
 * Handles coupon filtering, variant prices, and stock status detection.
 */

import type { ExtractionResult, RetailerParser } from '../engine/types';

export const amazonParser: RetailerParser = {
  name: 'Amazon',
  domains: [
    'amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de',
    'amazon.fr', 'amazon.it', 'amazon.es', 'amazon.co.jp',
    'amazon.com.au', 'amazon.in', 'amazon.com.br', 'amazon.nl',
    'amazon.se', 'amazon.pl', 'amazon.sg',
  ],
  extract(html: string, url: string): ExtractionResult {
    const result: ExtractionResult = {
      title: null,
      description: null,
      price: null,
      currency: null,
      image: null,
      gallery: [],
      brand: null,
      sku: null,
      mpn: null,
      gtin: null,
      inStock: null,
      availability: null,
      confidence: 0,
      source: 'amazon-parser',
    };

    // Extract title
    result.title = extractAmazonTitle(html);

    // Extract price from buy box (NOT coupons, NOT accessories)
    const priceData = extractAmazonBuyBoxPrice(html);
    if (priceData) {
      result.price = priceData.price;
      result.currency = priceData.currency;
    }

    // Extract image
    result.image = extractAmazonImage(html);

    // Extract brand
    result.brand = extractAmazonBrand(html);

    // Extract ASIN from URL
    result.sku = extractAsin(url);

    // Extract stock status
    const stock = extractAmazonStock(html);
    result.inStock = stock.inStock;
    result.availability = stock.availability;

    // Calculate confidence based on what was found
    let confidence = 0;
    if (result.title) confidence += 25;
    if (result.price) confidence += 35;
    if (result.image) confidence += 20;
    if (result.brand) confidence += 10;
    if (result.inStock !== null) confidence += 10;
    result.confidence = confidence;

    return result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Amazon-Specific Extraction Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractAmazonTitle(html: string): string | null {
  // #productTitle is the canonical product title on Amazon
  const match = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
  if (match) return match[1].trim();

  // Fallback: h1 with specific classes
  const h1Match = html.match(/<h1[^>]*class=["'][^"']*a-size-large[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return h1Match[1].trim().replace(/<[^>]+>/g, '');

  return null;
}

function extractAmazonBuyBoxPrice(html: string): { price: number; currency: string } | null {
  // Strategy: Look for price in buy box sections ONLY.
  // Never pick up coupon amounts ("Save $59") or accessory prices.

  // 1. priceToPay section (most reliable)
  const priceToPayMatch = html.match(
    /class=["'][^"']*priceToPay[^"']*["'][\s\S]*?class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.?\d*)/i
  );
  if (priceToPayMatch) {
    const price = parseFloat(priceToPayMatch[1].replace(/,/g, ''));
    if (price > 0) return { price, currency: 'USD' };
  }

  // 2. corePriceDisplay_desktop_feature_div
  const coreDisplayMatch = html.match(
    /id=["']corePriceDisplay_desktop_feature_div["'][\s\S]*?class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.?\d*)/i
  );
  if (coreDisplayMatch) {
    const price = parseFloat(coreDisplayMatch[1].replace(/,/g, ''));
    if (price > 0) return { price, currency: 'USD' };
  }

  // 3. corePrice_feature_div
  const coreFeatureMatch = html.match(
    /id=["']corePrice_feature_div["'][\s\S]*?class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.?\d*)/i
  );
  if (coreFeatureMatch) {
    const price = parseFloat(coreFeatureMatch[1].replace(/,/g, ''));
    if (price > 0) return { price, currency: 'USD' };
  }

  // 4. price_inside_buybox
  const buyboxMatch = html.match(
    /id=["']price_inside_buybox["'][\s\S]*?class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.?\d*)/i
  );
  if (buyboxMatch) {
    const price = parseFloat(buyboxMatch[1].replace(/,/g, ''));
    if (price > 0) return { price, currency: 'USD' };
  }

  // 5. Fallback: a-price-whole + a-price-fraction in the top 40% of page
  // (buy box is near the top, accessories/reviews are lower)
  const topHalf = html.slice(0, Math.floor(html.length * 0.4));
  const wholeMatch = topHalf.match(/class=["']a-price-whole["'][^>]*>([0-9,]+)/i);
  if (wholeMatch) {
    const fractionMatch = topHalf.match(/class=["']a-price-fraction["'][^>]*>(\d+)/i);
    const whole = wholeMatch[1].replace(/,/g, '');
    const fraction = fractionMatch ? fractionMatch[1] : '00';
    const price = parseFloat(`${whole}.${fraction}`);
    if (price > 0) return { price, currency: 'USD' };
  }

  return null;
}

function extractAmazonImage(html: string): string | null {
  // #landingImage is the main product image
  const landingMatch = html.match(/id=["']landingImage["'][^>]*src=["']([^"']+)["']/i);
  if (landingMatch && isValidProductImage(landingMatch[1])) return landingMatch[1];

  // data-a-dynamic-image attribute contains a JSON map of image URLs → dimensions
  const dynamicMatch = html.match(/data-a-dynamic-image=["'](\{[^"']+\})["']/i);
  if (dynamicMatch) {
    try {
      const imageMap = JSON.parse(dynamicMatch[1].replace(/&quot;/g, '"'));
      // Pick the largest image
      let bestUrl: string | null = null;
      let bestSize = 0;
      for (const [imgUrl, dims] of Object.entries(imageMap)) {
        const [w, h] = dims as [number, number];
        const size = w * h;
        if (size > bestSize && isValidProductImage(imgUrl)) {
          bestSize = size;
          bestUrl = imgUrl;
        }
      }
      if (bestUrl) return bestUrl;
    } catch { /* ignore parse errors */ }
  }

  // Fallback: imgBlkFront
  const blkFrontMatch = html.match(/id=["']imgBlkFront["'][^>]*src=["']([^"']+)["']/i);
  if (blkFrontMatch && isValidProductImage(blkFrontMatch[1])) return blkFrontMatch[1];

  return null;
}

function extractAmazonBrand(html: string): string | null {
  // bylineInfo link
  const bylineMatch = html.match(/id=["']bylineInfo["'][^>]*>([\s\S]*?)<\/a>/i);
  if (bylineMatch) {
    const text = bylineMatch[1].replace(/<[^>]+>/g, '').trim();
    // Remove "Visit the X Store" or "Brand: X" prefixes
    return text.replace(/^(Visit the |Brand:\s*)/i, '').replace(/\s*Store$/i, '').trim() || null;
  }

  // Brand row in product details
  const brandRowMatch = html.match(/Brand<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
  if (brandRowMatch) {
    return brandRowMatch[1].replace(/<[^>]+>/g, '').trim() || null;
  }

  return null;
}

function extractAsin(url: string): string | null {
  // Amazon ASIN is in the URL path: /dp/XXXXXXXXXX or /gp/product/XXXXXXXXXX
  const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return match ? match[1] : null;
}

function extractAmazonStock(html: string): { inStock: boolean | null; availability: string | null } {
  // Check #availability span
  const availMatch = html.match(/id=["']availability["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
  if (availMatch) {
    const text = availMatch[1].trim().replace(/<[^>]+>/g, '').trim().toLowerCase();
    if (text.includes('in stock')) return { inStock: true, availability: 'In Stock' };
    if (text.includes('currently unavailable') || text.includes('out of stock')) {
      return { inStock: false, availability: 'Out of Stock' };
    }
  }

  // Check for add-to-cart button presence
  const hasAddToCart = /id=["']add-to-cart-button["']/i.test(html);
  const hasBuyNow = /id=["']buy-now-button["']/i.test(html);
  if (hasAddToCart || hasBuyNow) return { inStock: true, availability: 'In Stock' };

  // Check for outOfStock div
  if (/id=["']outOfStock["']/i.test(html)) return { inStock: false, availability: 'Out of Stock' };

  return { inStock: null, availability: null };
}

function isValidProductImage(url: string): boolean {
  if (!url || url.length < 10) return false;
  if (url.includes('pixel') || url.includes('spacer') || url.includes('transparent')) return false;
  if (url.includes('icon') || url.includes('logo')) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
}
