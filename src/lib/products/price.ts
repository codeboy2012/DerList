/**
 * Confidence-based price extraction engine.
 *
 * Collects ALL price candidates from multiple sources, assigns each a confidence
 * score, and returns the highest-confidence result. This avoids the common trap
 * of regex patterns matching review counts, FPS values, or accessory prices.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceCandidate {
  value: number;
  source: string;
  confidence: number;
  currency: string | null;
}

export interface PriceResult {
  price: number;
  currency: string | null;
  source: string;
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the best price from HTML using a confidence-based candidate system.
 *
 * @param html - The page HTML content
 * @param domain - The domain (e.g., "amazon.com") for retailer-specific parsing
 * @returns The highest-confidence price result, or null if no valid price found
 */
export function extractBestPrice(html: string, domain: string | null): PriceResult | null {
  const candidates: PriceCandidate[] = [];

  // 1. JSON-LD Product Offer (confidence: 100)
  collectJsonLdPriceCandidates(html, candidates);

  // 2. Microdata itemprop="price" (confidence: 95)
  collectMicrodataPriceCandidates(html, candidates);

  // 3. Amazon-specific selectors (confidence: 90-95)
  if (isAmazonDomain(domain)) {
    collectAmazonPriceCandidates(html, candidates);
  }

  // 4. Other retailer-specific selectors (confidence: 90-92)
  collectRetailerPriceCandidates(html, domain, candidates);

  // 5. OpenGraph og:price:amount (confidence: 80)
  collectOgPriceCandidates(html, candidates);

  // 6. Generic price-class elements (confidence: 60)
  collectGenericPriceCandidates(html, candidates);

  // 7. Broad regex as last resort (confidence: 30)
  collectBroadRegexCandidates(html, candidates);

  // Filter out invalid candidates and noise
  const valid = candidates.filter((c) => isValidPrice(c.value) && !isNoise(c));

  if (valid.length === 0) return null;

  // Sort by confidence descending, then by value (prefer reasonable product prices)
  valid.sort((a, b) => b.confidence - a.confidence);

  const best = valid[0];
  return {
    price: best.value,
    currency: best.currency,
    source: best.source,
    confidence: best.confidence,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. JSON-LD Price Extraction
// ─────────────────────────────────────────────────────────────────────────────

function collectJsonLdPriceCandidates(html: string, candidates: PriceCandidate[]): void {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      extractPriceFromJsonLdObject(data, candidates);
    } catch {
      // Invalid JSON — skip
    }
  }
}

function extractPriceFromJsonLdObject(
  data: unknown,
  candidates: PriceCandidate[],
): void {
  if (!data || typeof data !== 'object') return;

  const obj = data as Record<string, unknown>;

  // Handle @graph arrays
  if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      extractPriceFromJsonLdObject(item, candidates);
    }
    return;
  }

  // Handle top-level arrays
  if (Array.isArray(data)) {
    for (const item of data) {
      extractPriceFromJsonLdObject(item, candidates);
    }
    return;
  }

  // Only extract from Product types
  const type = obj['@type'];
  const isProduct =
    (typeof type === 'string' && (type === 'Product' || type.includes('Product'))) ||
    (Array.isArray(type) && type.some((t: string) => t === 'Product' || t.includes('Product')));

  if (!isProduct) return;

  const offers = obj.offers;
  if (!offers || typeof offers !== 'object') return;

  const offerList = Array.isArray(offers) ? offers : [offers];

  for (const offerObj of offerList) {
    if (!offerObj || typeof offerObj !== 'object') continue;
    const offer = offerObj as Record<string, unknown>;

    const priceStr = String(offer.price ?? offer.lowPrice ?? offer.highPrice ?? '');
    const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    const currency = (typeof offer.priceCurrency === 'string' && offer.priceCurrency) || null;

    if (!isNaN(price) && price > 0) {
      candidates.push({
        value: price,
        source: 'json-ld-product-offer',
        confidence: 100,
        currency,
      });
      return; // Only take the first valid offer price
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Microdata itemprop="price"
// ─────────────────────────────────────────────────────────────────────────────

function collectMicrodataPriceCandidates(html: string, candidates: PriceCandidate[]): void {
  // itemprop="price" content="XXX"
  const patterns = [
    /itemprop=["']price["'][^>]*content=["']([0-9]+\.?[0-9]*)["']/gi,
    /content=["']([0-9]+\.?[0-9]*)["'][^>]*itemprop=["']price["']/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const price = parseFloat(match[1]);
      if (!isNaN(price) && price > 0) {
        candidates.push({
          value: price,
          source: 'microdata-itemprop-price',
          confidence: 95,
          currency: null,
        });
      }
    }
  }

  // Also check for itemprop="price" with visible text content
  const tagPattern = /<[^>]*itemprop=["']price["'][^>]*>([^<]*)</gi;
  let tagMatch;
  while ((tagMatch = tagPattern.exec(html)) !== null) {
    const text = tagMatch[1].trim();
    const price = parsePriceString(text);
    if (price !== null) {
      candidates.push({
        value: price,
        source: 'microdata-itemprop-price',
        confidence: 95,
        currency: detectCurrencyFromText(text),
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Amazon-Specific Price Extraction
// ─────────────────────────────────────────────────────────────────────────────

function isAmazonDomain(domain: string | null): boolean {
  if (!domain) return false;
  return /amazon\.(com|co\.uk|ca|de|fr|es|it|co\.jp|com\.au|in|com\.br|nl|se|pl|sg)/i.test(
    domain,
  );
}

function collectAmazonPriceCandidates(html: string, candidates: PriceCandidate[]): void {
  // Strategy: Look for price in the buy box sections specifically.
  // Amazon uses spans with class "a-offscreen" inside price containers.

  // High confidence: priceToPay section
  const priceToPayMatch = html.match(
    /class=["'][^"']*priceToPay[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.?[0-9]*)/i,
  );
  if (priceToPayMatch) {
    const price = parseFloat(priceToPayMatch[1].replace(/,/g, ''));
    if (!isNaN(price) && price > 0) {
      candidates.push({
        value: price,
        source: 'amazon-priceToPay',
        confidence: 95,
        currency: 'USD',
      });
    }
  }

  // corePriceDisplay_desktop_feature_div section
  const corePriceDesktopMatch = html.match(
    /id=["']corePriceDisplay_desktop_feature_div["'][\s\S]*?<span[^>]*class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.?[0-9]*)/i,
  );
  if (corePriceDesktopMatch) {
    const price = parseFloat(corePriceDesktopMatch[1].replace(/,/g, ''));
    if (!isNaN(price) && price > 0) {
      candidates.push({
        value: price,
        source: 'amazon-corePriceDisplay-desktop',
        confidence: 93,
        currency: 'USD',
      });
    }
  }

  // corePrice_feature_div section
  const coreFeatureMatch = html.match(
    /id=["']corePrice_feature_div["'][\s\S]*?<span[^>]*class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.?[0-9]*)/i,
  );
  if (coreFeatureMatch) {
    const price = parseFloat(coreFeatureMatch[1].replace(/,/g, ''));
    if (!isNaN(price) && price > 0) {
      candidates.push({
        value: price,
        source: 'amazon-corePrice-feature',
        confidence: 92,
        currency: 'USD',
      });
    }
  }

  // price_inside_buybox section
  const buyboxMatch = html.match(
    /id=["']price_inside_buybox["'][\s\S]*?<span[^>]*class=["']a-offscreen["'][^>]*>\s*\$([0-9,]+\.?[0-9]*)/i,
  );
  if (buyboxMatch) {
    const price = parseFloat(buyboxMatch[1].replace(/,/g, ''));
    if (!isNaN(price) && price > 0) {
      candidates.push({
        value: price,
        source: 'amazon-price-inside-buybox',
        confidence: 91,
        currency: 'USD',
      });
    }
  }

  // a-price-whole + a-price-fraction in buy box area (not in review/accessory sections)
  // Only match if NOT inside customerReviews or similar sections
  const buyBoxSection = extractBuyBoxSection(html);
  if (buyBoxSection) {
    const wholeMatch = buyBoxSection.match(
      /class=["']a-price-whole["'][^>]*>([0-9,]+)/i,
    );
    const fractionMatch = buyBoxSection.match(
      /class=["']a-price-fraction["'][^>]*>([0-9]+)/i,
    );
    if (wholeMatch) {
      const whole = wholeMatch[1].replace(/,/g, '');
      const fraction = fractionMatch ? fractionMatch[1] : '00';
      const price = parseFloat(`${whole}.${fraction}`);
      if (!isNaN(price) && price > 0) {
        candidates.push({
          value: price,
          source: 'amazon-a-price-buybox',
          confidence: 90,
          currency: 'USD',
        });
      }
    }
  }
}

/**
 * Extract the buy box section of an Amazon page, excluding reviews and accessories.
 */
function extractBuyBoxSection(html: string): string | null {
  // Try to isolate the buy box area — look for common container IDs
  const buyBoxPatterns = [
    /id=["']buyBoxInner["']([\s\S]*?)(?=id=["'](?:customerReviews|frequently-bought-together|similarities_feature_div)["']|$)/i,
    /id=["']desktop_buybox["']([\s\S]*?)(?=id=["'](?:customerReviews|frequently-bought-together|similarities_feature_div)["']|$)/i,
    /id=["']ppd["']([\s\S]*?)(?=id=["'](?:customerReviews|frequently-bought-together|similarities_feature_div)["']|$)/i,
    /id=["']centerCol["']([\s\S]*?)(?=id=["'](?:customerReviews|frequently-bought-together|similarities_feature_div)["']|$)/i,
  ];

  for (const pattern of buyBoxPatterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  // Fallback: take first 40% of HTML (buy box is usually near the top)
  const cutoff = Math.floor(html.length * 0.4);
  return html.slice(0, cutoff);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Other Retailer-Specific Selectors
// ─────────────────────────────────────────────────────────────────────────────

function collectRetailerPriceCandidates(
  html: string,
  domain: string | null,
  candidates: PriceCandidate[],
): void {
  if (!domain) return;

  const lowerDomain = domain.toLowerCase();

  // Best Buy
  if (lowerDomain.includes('bestbuy.com')) {
    const match = html.match(
      /class=["'][^"']*priceView-hero-price[^"']*["'][^>]*>[\s\S]*?\$([0-9,]+\.?[0-9]*)/i,
    );
    if (match) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(price) && price > 0) {
        candidates.push({ value: price, source: 'bestbuy-hero-price', confidence: 92, currency: 'USD' });
      }
    }
  }

  // Newegg
  if (lowerDomain.includes('newegg.com')) {
    const match = html.match(
      /class=["'][^"']*price-current[^"']*["'][^>]*>[\s\S]*?\$([0-9,]+\.?[0-9]*)/i,
    );
    if (match) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(price) && price > 0) {
        candidates.push({ value: price, source: 'newegg-price-current', confidence: 92, currency: 'USD' });
      }
    }
  }

  // Walmart
  if (lowerDomain.includes('walmart.com')) {
    const match = html.match(
      /itemprop=["']price["'][^>]*content=["']([0-9]+\.?[0-9]*)["']/i,
    );
    if (match) {
      const price = parseFloat(match[1]);
      if (!isNaN(price) && price > 0) {
        candidates.push({ value: price, source: 'walmart-itemprop', confidence: 92, currency: 'USD' });
      }
    }
  }

  // Target
  if (lowerDomain.includes('target.com')) {
    const match = html.match(
      /data-test=["']product-price["'][^>]*>\s*\$([0-9,]+\.?[0-9]*)/i,
    );
    if (match) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(price) && price > 0) {
        candidates.push({ value: price, source: 'target-product-price', confidence: 91, currency: 'USD' });
      }
    }
  }

  // Apple
  if (lowerDomain.includes('apple.com')) {
    const match = html.match(
      /class=["'][^"']*(?:rc-prices-currentprice|as-price-currentprice)[^"']*["'][^>]*>\s*\$([0-9,]+\.?[0-9]*)/i,
    );
    if (match) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(price) && price > 0) {
        candidates.push({ value: price, source: 'apple-current-price', confidence: 91, currency: 'USD' });
      }
    }
  }

  // B&H Photo
  if (lowerDomain.includes('bhphotovideo.com')) {
    const match = html.match(
      /data-selenium=["']pricingPrice["'][^>]*>\s*\$([0-9,]+\.?[0-9]*)/i,
    );
    if (match) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(price) && price > 0) {
        candidates.push({ value: price, source: 'bh-pricing-price', confidence: 90, currency: 'USD' });
      }
    }
  }

  // Micro Center
  if (lowerDomain.includes('microcenter.com')) {
    const match = html.match(
      /id=["']pricing["'][\s\S]*?\$([0-9,]+\.?[0-9]*)/i,
    );
    if (match) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(price) && price > 0) {
        candidates.push({ value: price, source: 'microcenter-pricing', confidence: 90, currency: 'USD' });
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. OpenGraph Price
// ─────────────────────────────────────────────────────────────────────────────

function collectOgPriceCandidates(html: string, candidates: PriceCandidate[]): void {
  const patterns = [
    /<meta[^>]*property=["']og:price:amount["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i,
    /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:price:amount["'][^>]*\/?>/i,
    /<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([^"']*)["'][^>]*\/?>/i,
    /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']product:price:amount["'][^>]*\/?>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const price = parseFloat(match[1].replace(/[^0-9.]/g, ''));
      if (!isNaN(price) && price > 0) {
        // Detect currency from companion meta tag
        const currencyMatch = html.match(
          /property=["'](?:og:price:currency|product:price:currency)["'][^>]*content=["']([A-Z]{3})["']/i,
        );
        candidates.push({
          value: price,
          source: 'og-price-amount',
          confidence: 80,
          currency: currencyMatch?.[1] ?? null,
        });
        return; // Only one OG price needed
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Generic Price-Class Elements
// ─────────────────────────────────────────────────────────────────────────────

function collectGenericPriceCandidates(html: string, candidates: PriceCandidate[]): void {
  // data-price attribute
  const dataPriceMatch = html.match(/data-price=["']([0-9]+\.?[0-9]*)["']/i);
  if (dataPriceMatch) {
    const price = parseFloat(dataPriceMatch[1]);
    if (!isNaN(price) && price > 0) {
      candidates.push({
        value: price,
        source: 'data-price-attribute',
        confidence: 60,
        currency: null,
      });
    }
  }

  // Elements with class containing "price" and a dollar amount inside
  // Be careful to not match inside review sections
  const priceClassPattern =
    /class=["'][^"']*(?:product-price|sale-price|current-price|final-price|our-price)[^"']*["'][^>]*>[^<]*\$([0-9,]+\.?[0-9]*)/gi;
  let priceClassMatch;
  while ((priceClassMatch = priceClassPattern.exec(html)) !== null) {
    const price = parseFloat(priceClassMatch[1].replace(/,/g, ''));
    if (!isNaN(price) && price > 0) {
      candidates.push({
        value: price,
        source: 'generic-price-class',
        confidence: 60,
        currency: 'USD',
      });
      break; // Only take the first
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Broad Regex (last resort)
// ─────────────────────────────────────────────────────────────────────────────

function collectBroadRegexCandidates(html: string, candidates: PriceCandidate[]): void {
  // Only use a very targeted broad pattern — look for price near buy/add-to-cart context
  const buyContextPattern =
    /(?:add.to.cart|buy.now|purchase|checkout)[^>]{0,500}?\$([0-9,]+\.[0-9]{2})/i;
  const match = html.match(buyContextPattern);
  if (match) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(price) && price > 0) {
      candidates.push({
        value: price,
        source: 'broad-regex-buy-context',
        confidence: 30,
        currency: 'USD',
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Noise Filtering
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a candidate is likely noise (review numbers, FPS, warranties, etc.)
 */
function isNoise(candidate: PriceCandidate): boolean {
  const { value } = candidate;

  // Very small values are likely ratings (1-5 stars) or review counts misread
  if (value < 1) return true;

  // Values that look like review star ratings (e.g., 4.5, 3.8)
  if (value <= 5 && Number.isFinite(value)) {
    // Only filter if from a low-confidence source
    if (candidate.confidence < 60) return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidPrice(value: number): boolean {
  return !isNaN(value) && value > 0 && value < 1_000_000;
}

function parsePriceString(text: string): number | null {
  // Remove currency symbols and whitespace, parse the number
  const cleaned = text.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const price = parseFloat(cleaned);
  return !isNaN(price) && price > 0 ? price : null;
}

function detectCurrencyFromText(text: string): string | null {
  if (text.includes('$')) return 'USD';
  if (text.includes('€')) return 'EUR';
  if (text.includes('£')) return 'GBP';
  if (text.includes('¥')) return 'JPY';
  return null;
}
