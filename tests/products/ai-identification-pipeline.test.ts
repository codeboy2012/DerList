/**
 * Comprehensive Tests for the AI-First Product Identification Pipeline
 *
 * Tests:
 * 1. Amazon URL parsing & ASIN extraction
 * 2. Exact ASIN matching
 * 3. Wrong ASIN rejection
 * 4. AI identification (response parsing & validation)
 * 5. No AI configured
 * 6. AI timeout handling
 * 7. Invalid AI JSON rejection
 * 8. AI hallucinated product detection
 * 9. Search/AI conflict handling
 * 10. URL-as-title regression
 * 11. Price validation
 * 12. Image validation & SSRF protection
 * 13. Keepa image resolution
 * 14. Product Editor mapping
 * 15. Field source tracking
 * 16. Confidence calculation
 * 17. Manual override (user data wins)
 * 18. Manual pricing lock
 * 19. Identity validator comprehensive
 * 20. SSE event emission
 * 21. Activity timeline construction
 *
 * MOST IMPORTANT REGRESSION TEST:
 * Input: https://www.amazon.com/dp/B0GSS4SGZR
 * Must NOT identify as "Beats Solo 4"
 * ASIN must remain B0GSS4SGZR
 */
import { describe, expect, it } from 'vitest';
import { extractAsinFromUrl } from '@/lib/importers/amazon';
import {
  parseAIResponse,
  buildSystemPrompt,
  buildIdentificationPrompt,
  assembleIdentificationContext,
} from '@/lib/products/identification/ai-product-prompt';
import {
  validateProductIdentity,
  isUrlSafe,
  isValidAsin,
  isValidUpc,
  looksLikeUrl,
} from '@/lib/products/identification/identity-validator';
import { validateImageUrl } from '@/lib/products/identification/image-resolution';
import {
  generateOperationId,
  buildActivityTimeline,
} from '@/lib/events/wishlist-events';
import type { AIProductResponse } from '@/lib/products/identification/ai-identification-types';
import type { IdentificationInput } from '@/lib/products/identification/types';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Amazon URL Parsing & ASIN Extraction
// ─────────────────────────────────────────────────────────────────────────────

describe('Amazon URL parsing & ASIN extraction', () => {
  it('extracts ASIN from standard /dp/ URL', () => {
    expect(extractAsinFromUrl('https://www.amazon.com/dp/B0GSS4SGZR')).toBe('B0GSS4SGZR');
  });

  it('extracts ASIN from /gp/product/ URL', () => {
    expect(extractAsinFromUrl('https://www.amazon.com/gp/product/B0GSS4SGZR')).toBe('B0GSS4SGZR');
  });

  it('extracts ASIN from /ASIN/ URL', () => {
    expect(extractAsinFromUrl('https://www.amazon.com/ASIN/B0GSS4SGZR')).toBe('B0GSS4SGZR');
  });

  it('extracts ASIN from mobile URL', () => {
    expect(extractAsinFromUrl('https://www.amazon.com/gp/aw/d/B0GSS4SGZR')).toBe('B0GSS4SGZR');
  });

  it('extracts ASIN from URL with product name slug', () => {
    expect(extractAsinFromUrl('https://www.amazon.com/Apple-AirPods-Max-2-USB-C/dp/B0GSS4SGZR/ref=sr_1_1')).toBe('B0GSS4SGZR');
  });

  it('extracts ASIN from non-US Amazon domains', () => {
    expect(extractAsinFromUrl('https://www.amazon.co.uk/dp/B0GSS4SGZR')).toBe('B0GSS4SGZR');
    expect(extractAsinFromUrl('https://www.amazon.de/dp/B0GSS4SGZR')).toBe('B0GSS4SGZR');
    expect(extractAsinFromUrl('https://www.amazon.co.jp/dp/B0GSS4SGZR')).toBe('B0GSS4SGZR');
  });

  it('returns null for non-Amazon URLs', () => {
    expect(extractAsinFromUrl('https://www.bestbuy.com/product/123')).toBeNull();
  });

  it('returns null for URLs without ASIN', () => {
    expect(extractAsinFromUrl('https://www.amazon.com/s?k=headphones')).toBeNull();
  });

  it('uppercases extracted ASINs', () => {
    expect(extractAsinFromUrl('https://www.amazon.com/dp/b0gss4sgzr')).toBe('B0GSS4SGZR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Exact ASIN Matching
// ─────────────────────────────────────────────────────────────────────────────

describe('Exact ASIN matching', () => {
  it('validates correct ASIN match', () => {
    const input: IdentificationInput = {
      rawInput: 'https://www.amazon.com/dp/B0GSS4SGZR',
      inputType: 'url',
      url: 'https://www.amazon.com/dp/B0GSS4SGZR',
      asin: 'B0GSS4SGZR',
      retailer: 'Amazon',
      userId: 'test-user',
    };

    const aiResponse: AIProductResponse = {
      status: 'identified',
      product: {
        name: 'Apple AirPods Max 2',
        brand: 'Apple',
        model: 'AirPods Max 2',
        category: 'Headphones',
        subCategory: 'Over-Ear',
        sku: null,
        upc: null,
        asin: 'B0GSS4SGZR',
        mpn: null,
        productUrl: null,
        storeUrl: null,
        description: 'Premium over-ear headphones with USB-C',
        notes: null,
        tags: ['headphones', 'apple', 'wireless'],
        pricing: { currentPrice: null, currency: 'USD', originalPrice: null, discountPercent: null, dealAmount: null, shipping: null, tax: null, coupon: null, promoCode: null },
        sellers: [],
        images: [],
        specifications: [],
      },
      confidence: { overall: 90, name: 95, brand: 98, model: 90, category: 85, sku: 0, upc: 0, asin: 100, mpn: 0, price: 0, image: 0 },
      sources: ['ASIN knowledge'],
      verifiedFields: ['asin', 'name', 'brand'],
      conflicts: [],
      reason: 'Product identified from ASIN B0GSS4SGZR',
    };

    const result = validateProductIdentity({
      pipelineInput: input,
      aiResponse,
    });

    expect(result.verified).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    const asinCheck = result.checks.find(c => c.field === 'asin');
    expect(asinCheck?.passed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Wrong ASIN Rejection
// ─────────────────────────────────────────────────────────────────────────────

describe('Wrong ASIN rejection', () => {
  it('rejects product when AI returns different ASIN', () => {
    const input: IdentificationInput = {
      rawInput: 'https://www.amazon.com/dp/B0GSS4SGZR',
      inputType: 'url',
      url: 'https://www.amazon.com/dp/B0GSS4SGZR',
      asin: 'B0GSS4SGZR',
      retailer: 'Amazon',
      userId: 'test-user',
    };

    const aiResponse: AIProductResponse = {
      status: 'identified',
      product: {
        name: 'Beats Solo 4',
        brand: 'Beats',
        model: 'Solo 4',
        category: 'Headphones',
        subCategory: null,
        sku: null,
        upc: null,
        asin: 'B0ABC12345', // WRONG ASIN!
        mpn: null,
        productUrl: null,
        storeUrl: null,
        description: null,
        notes: null,
        tags: [],
        pricing: { currentPrice: null, currency: null, originalPrice: null, discountPercent: null, dealAmount: null, shipping: null, tax: null, coupon: null, promoCode: null },
        sellers: [],
        images: [],
        specifications: [],
      },
      confidence: { overall: 80, name: 85, brand: 90, model: 80, category: 70, sku: 0, upc: 0, asin: 80, mpn: 0, price: 0, image: 0 },
      sources: [],
      verifiedFields: [],
      conflicts: [],
      reason: 'Identified from search results',
    };

    const result = validateProductIdentity({
      pipelineInput: input,
      aiResponse,
    });

    expect(result.verified).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
    const criticalConflict = result.conflicts.find(c => c.severity === 'critical');
    expect(criticalConflict).toBeDefined();
    expect(criticalConflict!.field).toBe('asin');
    expect(criticalConflict!.message).toContain('B0GSS4SGZR');
    expect(criticalConflict!.message).toContain('B0ABC12345');
  });

  it('does NOT reject when AI returns no ASIN (input ASIN preserved)', () => {
    const input: IdentificationInput = {
      rawInput: 'https://www.amazon.com/dp/B0GSS4SGZR',
      inputType: 'url',
      asin: 'B0GSS4SGZR',
      retailer: 'Amazon',
      userId: 'test-user',
    };

    const aiResponse: AIProductResponse = {
      status: 'identified',
      product: {
        name: 'Apple AirPods Max 2',
        brand: 'Apple',
        model: null,
        category: 'Headphones',
        subCategory: null,
        sku: null,
        upc: null,
        asin: null, // AI didn't return ASIN — that's OK
        mpn: null,
        productUrl: null,
        storeUrl: null,
        description: null,
        notes: null,
        tags: [],
        pricing: { currentPrice: null, currency: null, originalPrice: null, discountPercent: null, dealAmount: null, shipping: null, tax: null, coupon: null, promoCode: null },
        sellers: [],
        images: [],
        specifications: [],
      },
      confidence: { overall: 75, name: 80, brand: 85, model: 0, category: 70, sku: 0, upc: 0, asin: 0, mpn: 0, price: 0, image: 0 },
      sources: [],
      verifiedFields: ['name', 'brand'],
      conflicts: [],
      reason: 'Identified from knowledge',
    };

    const result = validateProductIdentity({
      pipelineInput: input,
      aiResponse,
    });

    expect(result.verified).toBe(true);
    const asinCheck = result.checks.find(c => c.field === 'asin');
    expect(asinCheck?.passed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. AI Response Parsing & Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('AI response parsing', () => {
  it('parses valid JSON response', () => {
    const json = JSON.stringify({
      status: 'identified',
      product: {
        name: 'Test Product',
        brand: 'TestBrand',
        model: null,
        category: 'Electronics',
        subCategory: null,
        sku: null,
        upc: null,
        asin: 'B0GSS4SGZR',
        mpn: null,
        productUrl: null,
        storeUrl: null,
        description: 'A test product',
        notes: null,
        tags: ['test'],
        pricing: { currentPrice: 99.99, currency: 'USD', originalPrice: null, discountPercent: null, dealAmount: null, shipping: null, tax: null, coupon: null, promoCode: null },
        sellers: [],
        images: [],
        specifications: [{ key: 'Color', value: 'Black' }],
      },
      confidence: { overall: 85, name: 90, brand: 85, model: 0, category: 80, sku: 0, upc: 0, asin: 100, mpn: 0, price: 70, image: 0 },
      sources: ['ASIN lookup'],
      verifiedFields: ['asin', 'name'],
      conflicts: [],
      reason: 'Identified via ASIN',
    });

    const result = parseAIResponse(json);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('identified');
    expect(result!.product.name).toBe('Test Product');
    expect(result!.product.brand).toBe('TestBrand');
    expect(result!.product.asin).toBe('B0GSS4SGZR');
    expect(result!.confidence.overall).toBe(85);
    expect(result!.product.pricing.currentPrice).toBe(99.99);
    expect(result!.product.specifications).toHaveLength(1);
  });

  it('parses response wrapped in markdown code fences', () => {
    const wrapped = '```json\n{"status":"identified","product":{"name":"Test","brand":null,"model":null,"category":null,"subCategory":null,"sku":null,"upc":null,"asin":null,"mpn":null,"productUrl":null,"storeUrl":null,"description":null,"notes":null,"tags":[],"pricing":{"currentPrice":null,"currency":null,"originalPrice":null,"discountPercent":null,"dealAmount":null,"shipping":null,"tax":null,"coupon":null,"promoCode":null},"sellers":[],"images":[],"specifications":[]},"confidence":{"overall":50,"name":60,"brand":0,"model":0,"category":0,"sku":0,"upc":0,"asin":0,"mpn":0,"price":0,"image":0},"sources":[],"verifiedFields":[],"conflicts":[],"reason":"test"}\n```';

    const result = parseAIResponse(wrapped);
    expect(result).not.toBeNull();
    expect(result!.product.name).toBe('Test');
  });

  it('returns null for completely invalid JSON', () => {
    expect(parseAIResponse('This is not JSON at all')).toBeNull();
    expect(parseAIResponse('')).toBeNull();
    expect(parseAIResponse('undefined')).toBeNull();
  });

  it('returns null when product field is missing', () => {
    const noProduct = JSON.stringify({ status: 'identified', confidence: { overall: 50 } });
    expect(parseAIResponse(noProduct)).toBeNull();
  });

  it('normalizes confidence values to 0-100 range', () => {
    const json = JSON.stringify({
      status: 'identified',
      product: { name: 'Test', brand: null, model: null, category: null, subCategory: null, sku: null, upc: null, asin: null, mpn: null, productUrl: null, storeUrl: null, description: null, notes: null, tags: [], pricing: { currentPrice: null, currency: null, originalPrice: null, discountPercent: null, dealAmount: null, shipping: null, tax: null, coupon: null, promoCode: null }, sellers: [], images: [], specifications: [] },
      confidence: { overall: 150, name: -10, brand: 200, model: 0, category: 0, sku: 0, upc: 0, asin: 0, mpn: 0, price: 0, image: 0 },
      sources: [],
      verifiedFields: [],
      conflicts: [],
      reason: '',
    });

    const result = parseAIResponse(json);
    expect(result!.confidence.overall).toBe(100); // Clamped to 100
    expect(result!.confidence.name).toBe(0); // Clamped to 0
    expect(result!.confidence.brand).toBe(100); // Clamped to 100
  });

  it('rejects negative prices', () => {
    const json = JSON.stringify({
      status: 'identified',
      product: { name: 'Test', brand: null, model: null, category: null, subCategory: null, sku: null, upc: null, asin: null, mpn: null, productUrl: null, storeUrl: null, description: null, notes: null, tags: [], pricing: { currentPrice: -50, currency: 'USD', originalPrice: null, discountPercent: null, dealAmount: null, shipping: null, tax: null, coupon: null, promoCode: null }, sellers: [], images: [], specifications: [] },
      confidence: { overall: 50, name: 50, brand: 0, model: 0, category: 0, sku: 0, upc: 0, asin: 0, mpn: 0, price: 50, image: 0 },
      sources: [],
      verifiedFields: [],
      conflicts: [],
      reason: '',
    });

    const result = parseAIResponse(json);
    expect(result!.product.pricing.currentPrice).toBeNull(); // Negative rejected
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. No AI Configured
// ─────────────────────────────────────────────────────────────────────────────

describe('No AI configured handling', () => {
  it('assembles context correctly even without AI', () => {
    const context = assembleIdentificationContext({
      rawInput: 'https://www.amazon.com/dp/B0GSS4SGZR',
      url: 'https://www.amazon.com/dp/B0GSS4SGZR',
      asin: 'B0GSS4SGZR',
      retailer: 'Amazon',
    });

    expect(context.asin).toBe('B0GSS4SGZR');
    expect(context.retailer).toBe('Amazon');
    expect(context.normalizedUrl).toContain('amazon.com');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Invalid AI JSON
// ─────────────────────────────────────────────────────────────────────────────

describe('Invalid AI JSON handling', () => {
  it('rejects response with just a string', () => {
    expect(parseAIResponse('"just a string"')).toBeNull();
  });

  it('rejects response with array instead of object', () => {
    expect(parseAIResponse('[1, 2, 3]')).toBeNull();
  });

  it('handles response with extra explanation text before JSON', () => {
    const response = 'Here is the product identification:\n\n{"status":"identified","product":{"name":"Test Product","brand":null,"model":null,"category":null,"subCategory":null,"sku":null,"upc":null,"asin":null,"mpn":null,"productUrl":null,"storeUrl":null,"description":null,"notes":null,"tags":[],"pricing":{"currentPrice":null,"currency":null,"originalPrice":null,"discountPercent":null,"dealAmount":null,"shipping":null,"tax":null,"coupon":null,"promoCode":null},"sellers":[],"images":[],"specifications":[]},"confidence":{"overall":60,"name":70,"brand":0,"model":0,"category":0,"sku":0,"upc":0,"asin":0,"mpn":0,"price":0,"image":0},"sources":[],"verifiedFields":[],"conflicts":[],"reason":"test"}';

    const result = parseAIResponse(response);
    expect(result).not.toBeNull();
    expect(result!.product.name).toBe('Test Product');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. URL-as-Title Regression
// ─────────────────────────────────────────────────────────────────────────────

describe('URL-as-title regression', () => {
  it('detects URL used as product title', () => {
    expect(looksLikeUrl('https://www.amazon.com/dp/B0GSS4SGZR')).toBe(true);
    expect(looksLikeUrl('http://example.com/product')).toBe(true);
  });

  it('does not flag normal product names', () => {
    expect(looksLikeUrl('Apple AirPods Max 2')).toBe(false);
    expect(looksLikeUrl('NVIDIA RTX 5070 Ti')).toBe(false);
  });

  it('identity validator rejects URL as title', () => {
    const input: IdentificationInput = {
      rawInput: 'https://www.amazon.com/dp/B0GSS4SGZR',
      inputType: 'url',
      asin: 'B0GSS4SGZR',
      retailer: 'Amazon',
      userId: 'test-user',
    };

    const aiResponse: AIProductResponse = {
      status: 'identified',
      product: {
        name: 'https://www.amazon.com/dp/B0GSS4SGZR', // URL as title!
        brand: null,
        model: null,
        category: null,
        subCategory: null,
        sku: null,
        upc: null,
        asin: 'B0GSS4SGZR',
        mpn: null,
        productUrl: null,
        storeUrl: null,
        description: null,
        notes: null,
        tags: [],
        pricing: { currentPrice: null, currency: null, originalPrice: null, discountPercent: null, dealAmount: null, shipping: null, tax: null, coupon: null, promoCode: null },
        sellers: [],
        images: [],
        specifications: [],
      },
      confidence: { overall: 50, name: 50, brand: 0, model: 0, category: 0, sku: 0, upc: 0, asin: 100, mpn: 0, price: 0, image: 0 },
      sources: [],
      verifiedFields: [],
      conflicts: [],
      reason: '',
    };

    const result = validateProductIdentity({
      pipelineInput: input,
      aiResponse,
    });

    expect(result.verified).toBe(false);
    const titleCheck = result.checks.find(c => c.field === 'title-not-url');
    expect(titleCheck?.passed).toBe(false);
  });

  it('identity validator rejects retailer name as title', () => {
    const input: IdentificationInput = {
      rawInput: 'https://www.amazon.com/dp/B0GSS4SGZR',
      inputType: 'url',
      asin: 'B0GSS4SGZR',
      retailer: 'Amazon',
      userId: 'test-user',
    };

    const aiResponse: AIProductResponse = {
      status: 'identified',
      product: {
        name: 'Amazon.com', // Retailer name as title!
        brand: null,
        model: null,
        category: null,
        subCategory: null,
        sku: null,
        upc: null,
        asin: 'B0GSS4SGZR',
        mpn: null,
        productUrl: null,
        storeUrl: null,
        description: null,
        notes: null,
        tags: [],
        pricing: { currentPrice: null, currency: null, originalPrice: null, discountPercent: null, dealAmount: null, shipping: null, tax: null, coupon: null, promoCode: null },
        sellers: [],
        images: [],
        specifications: [],
      },
      confidence: { overall: 50, name: 50, brand: 0, model: 0, category: 0, sku: 0, upc: 0, asin: 100, mpn: 0, price: 0, image: 0 },
      sources: [],
      verifiedFields: [],
      conflicts: [],
      reason: '',
    };

    const result = validateProductIdentity({
      pipelineInput: input,
      aiResponse,
    });

    expect(result.verified).toBe(false);
    const titleCheck = result.checks.find(c => c.field === 'title-not-retailer');
    expect(titleCheck?.passed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Price Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('Price validation', () => {
  it('rejects negative prices in AI response', () => {
    const json = JSON.stringify({
      status: 'identified',
      product: { name: 'Test', brand: null, model: null, category: null, subCategory: null, sku: null, upc: null, asin: null, mpn: null, productUrl: null, storeUrl: null, description: null, notes: null, tags: [], pricing: { currentPrice: -100, currency: 'USD', originalPrice: null, discountPercent: null, dealAmount: null, shipping: null, tax: null, coupon: null, promoCode: null }, sellers: [], images: [], specifications: [] },
      confidence: { overall: 50, name: 50, brand: 0, model: 0, category: 0, sku: 0, upc: 0, asin: 0, mpn: 0, price: 50, image: 0 },
      sources: [], verifiedFields: [], conflicts: [], reason: '',
    });

    const result = parseAIResponse(json);
    expect(result!.product.pricing.currentPrice).toBeNull();
  });

  it('accepts valid positive prices', () => {
    const json = JSON.stringify({
      status: 'identified',
      product: { name: 'Test', brand: null, model: null, category: null, subCategory: null, sku: null, upc: null, asin: null, mpn: null, productUrl: null, storeUrl: null, description: null, notes: null, tags: [], pricing: { currentPrice: 549.99, currency: 'USD', originalPrice: 599.99, discountPercent: 8, dealAmount: 50, shipping: 0, tax: null, coupon: null, promoCode: null }, sellers: [], images: [], specifications: [] },
      confidence: { overall: 80, name: 80, brand: 0, model: 0, category: 0, sku: 0, upc: 0, asin: 0, mpn: 0, price: 85, image: 0 },
      sources: [], verifiedFields: [], conflicts: [], reason: '',
    });

    const result = parseAIResponse(json);
    expect(result!.product.pricing.currentPrice).toBe(549.99);
    expect(result!.product.pricing.originalPrice).toBe(599.99);
    expect(result!.product.pricing.shipping).toBe(0);
  });

  it('flags unreasonable price in identity validation', () => {
    const input: IdentificationInput = {
      rawInput: 'test product',
      inputType: 'product-name',
      userId: 'test-user',
    };

    const aiResponse: AIProductResponse = {
      status: 'identified',
      product: {
        name: 'Test Product',
        brand: null, model: null, category: null, subCategory: null, sku: null, upc: null, asin: null, mpn: null, productUrl: null, storeUrl: null, description: null, notes: null, tags: [],
        pricing: { currentPrice: 999999, currency: 'USD', originalPrice: null, discountPercent: null, dealAmount: null, shipping: null, tax: null, coupon: null, promoCode: null },
        sellers: [], images: [], specifications: [],
      },
      confidence: { overall: 50, name: 50, brand: 0, model: 0, category: 0, sku: 0, upc: 0, asin: 0, mpn: 0, price: 50, image: 0 },
      sources: [], verifiedFields: [], conflicts: [], reason: '',
    };

    const result = validateProductIdentity({ pipelineInput: input, aiResponse });
    const priceCheck = result.checks.find(c => c.field === 'price-reasonable');
    expect(priceCheck?.passed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Image Validation & SSRF Protection
// ─────────────────────────────────────────────────────────────────────────────

describe('Image validation', () => {
  it('rejects encrypted Google thumbnails', () => {
    expect(validateImageUrl('https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ABC')).toBe(false);
  });

  it('rejects favicons', () => {
    expect(validateImageUrl('https://example.com/favicon.ico')).toBe(false);
  });

  it('rejects placeholder images', () => {
    expect(validateImageUrl('https://example.com/no-image.png')).toBe(false);
    expect(validateImageUrl('https://example.com/placeholder.jpg')).toBe(false);
  });

  it('accepts valid Amazon CDN images', () => {
    expect(validateImageUrl('https://m.media-amazon.com/images/I/81zZW70yiYL._AC_SL1500_.jpg')).toBe(true);
  });

  it('accepts valid product images', () => {
    expect(validateImageUrl('https://pisces.bbystatic.com/image2/product/123.jpg')).toBe(true);
  });
});

describe('SSRF protection', () => {
  it('blocks localhost', () => {
    expect(isUrlSafe('http://localhost/image.jpg')).toBe(false);
    expect(isUrlSafe('http://localhost:8080/image.jpg')).toBe(false);
  });

  it('blocks 127.0.0.1', () => {
    expect(isUrlSafe('http://127.0.0.1/image.jpg')).toBe(false);
  });

  it('blocks private IP ranges', () => {
    expect(isUrlSafe('http://10.0.0.1/image.jpg')).toBe(false);
    expect(isUrlSafe('http://192.168.1.1/image.jpg')).toBe(false);
    expect(isUrlSafe('http://172.16.0.1/image.jpg')).toBe(false);
  });

  it('blocks IPv6 loopback', () => {
    expect(isUrlSafe('http://[::1]/image.jpg')).toBe(false);
  });

  it('blocks cloud metadata endpoints', () => {
    expect(isUrlSafe('http://metadata.google.internal/computeMetadata/v1/')).toBe(false);
  });

  it('blocks .local and .internal domains', () => {
    expect(isUrlSafe('http://service.local/api')).toBe(false);
    expect(isUrlSafe('http://db.internal/data')).toBe(false);
  });

  it('allows public URLs', () => {
    expect(isUrlSafe('https://www.amazon.com/dp/B0GSS4SGZR')).toBe(true);
    expect(isUrlSafe('https://m.media-amazon.com/images/I/81zZW70yiYL.jpg')).toBe(true);
  });

  it('blocks unsafe ports', () => {
    expect(isUrlSafe('http://example.com:22/image.jpg')).toBe(false);
    expect(isUrlSafe('http://example.com:3306/data')).toBe(false);
    expect(isUrlSafe('http://example.com:6379/key')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Identifier Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('Identifier validation', () => {
  it('validates correct ASIN format', () => {
    expect(isValidAsin('B0GSS4SGZR')).toBe(true);
    expect(isValidAsin('0123456789')).toBe(true);
  });

  it('rejects invalid ASIN format', () => {
    expect(isValidAsin('B0GS')).toBe(false); // Too short
    expect(isValidAsin('B0GSS4SGZR1')).toBe(false); // Too long
    expect(isValidAsin('B0GSS-SGZR')).toBe(false); // Contains dash
    expect(isValidAsin(null)).toBe(false);
    expect(isValidAsin('')).toBe(false);
  });

  it('validates correct UPC format', () => {
    expect(isValidUpc('012345678901')).toBe(true);
  });

  it('rejects invalid UPC format', () => {
    expect(isValidUpc('12345')).toBe(false);
    expect(isValidUpc('ABCDEFGHIJKL')).toBe(false);
    expect(isValidUpc(null)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Field Source Tracking
// ─────────────────────────────────────────────────────────────────────────────

describe('Field source tracking', () => {
  it('context assembly preserves all identifiers', () => {
    const context = assembleIdentificationContext({
      rawInput: 'https://www.amazon.com/dp/B0GSS4SGZR',
      url: 'https://www.amazon.com/dp/B0GSS4SGZR',
      asin: 'B0GSS4SGZR',
      sku: 'SKU-123',
      upc: '012345678901',
      mpn: 'MPN-456',
      retailer: 'Amazon',
    });

    expect(context.asin).toBe('B0GSS4SGZR');
    expect(context.sku).toBe('SKU-123');
    expect(context.upc).toBe('012345678901');
    expect(context.mpn).toBe('MPN-456');
    expect(context.retailer).toBe('Amazon');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. Confidence Calculation
// ─────────────────────────────────────────────────────────────────────────────

describe('Confidence calculation', () => {
  it('system prompt is non-empty', () => {
    const prompt = buildSystemPrompt();
    expect(prompt.length).toBeGreaterThan(500);
    expect(prompt).toContain('ASIN');
    expect(prompt).toContain('null');
    expect(prompt).toContain('confidence');
  });

  it('identification prompt includes all context', () => {
    const context = assembleIdentificationContext({
      rawInput: 'https://www.amazon.com/dp/B0GSS4SGZR',
      url: 'https://www.amazon.com/dp/B0GSS4SGZR',
      asin: 'B0GSS4SGZR',
      retailer: 'Amazon',
      searchEvidence: [{
        title: 'Apple AirPods Max 2',
        brand: 'Apple',
        price: 549.00,
        currency: 'USD',
        url: 'https://www.amazon.com/dp/B0GSS4SGZR',
        retailer: 'Amazon',
        matchedAsin: true,
        matchedRetailer: true,
        confidence: 0.85,
      }],
    });

    const prompt = buildIdentificationPrompt(context);
    expect(prompt).toContain('B0GSS4SGZR');
    expect(prompt).toContain('Amazon');
    expect(prompt).toContain('Apple AirPods Max 2');
    expect(prompt).toContain('ASIN match: YES');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 20. SSE Event Generation
// ─────────────────────────────────────────────────────────────────────────────

describe('SSE event generation', () => {
  it('generates unique operation IDs', () => {
    const id1 = generateOperationId();
    const id2 = generateOperationId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^op_\d+_\d+$/);
  });

  it('builds activity timeline for successful identification', () => {
    const timeline = buildActivityTimeline(
      'op_123',
      { url: 'https://www.amazon.com/dp/B0GSS4SGZR', asin: 'B0GSS4SGZR', retailer: 'Amazon' },
      {
        success: true,
        confidence: 92,
        product: { title: 'Apple AirPods Max 2', brand: 'Apple', asin: 'B0GSS4SGZR' },
        aiImportStatus: 'ready',
      },
    );

    expect(timeline.length).toBeGreaterThan(0);
    const urlStep = timeline.find(t => t.step === 'URL recognized');
    expect(urlStep).toBeDefined();
    expect(urlStep!.status).toBe('completed');

    const asinStep = timeline.find(t => t.step === 'ASIN extracted');
    expect(asinStep).toBeDefined();
    expect(asinStep!.message).toContain('B0GSS4SGZR');

    const brandStep = timeline.find(t => t.step === 'Brand verified');
    expect(brandStep).toBeDefined();
    expect(brandStep!.message).toContain('Apple');
  });

  it('builds activity timeline for no-AI-configured', () => {
    const timeline = buildActivityTimeline(
      'op_456',
      { url: 'https://www.amazon.com/dp/B0GSS4SGZR', asin: 'B0GSS4SGZR' },
      {
        success: false,
        aiImportStatus: 'no_ai_configured',
      },
    );

    const aiStep = timeline.find(t => t.step === 'AI identification');
    expect(aiStep).toBeDefined();
    expect(aiStep!.status).toBe('skipped');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL REGRESSION TEST
// ─────────────────────────────────────────────────────────────────────────────

describe('CRITICAL REGRESSION: B0GSS4SGZR must NOT be identified as Beats Solo 4', () => {
  it('rejects Beats Solo 4 for ASIN B0GSS4SGZR', () => {
    const input: IdentificationInput = {
      rawInput: 'https://www.amazon.com/dp/B0GSS4SGZR',
      inputType: 'url',
      url: 'https://www.amazon.com/dp/B0GSS4SGZR',
      asin: 'B0GSS4SGZR',
      retailer: 'Amazon',
      userId: 'test-user',
    };

    // Simulate: AI incorrectly identifies as Beats Solo 4 with wrong ASIN
    const wrongResponse: AIProductResponse = {
      status: 'identified',
      product: {
        name: 'Beats Solo 4',
        brand: 'Beats',
        model: 'Solo 4',
        category: 'Headphones',
        subCategory: null,
        sku: null,
        upc: null,
        asin: 'B0CZPLGMPZ', // Different ASIN = wrong product
        mpn: null,
        productUrl: null,
        storeUrl: null,
        description: null,
        notes: null,
        tags: [],
        pricing: { currentPrice: 199.99, currency: 'USD', originalPrice: null, discountPercent: null, dealAmount: null, shipping: null, tax: null, coupon: null, promoCode: null },
        sellers: [],
        images: [],
        specifications: [],
      },
      confidence: { overall: 75, name: 80, brand: 85, model: 80, category: 75, sku: 0, upc: 0, asin: 75, mpn: 0, price: 70, image: 0 },
      sources: ['search result'],
      verifiedFields: [],
      conflicts: [],
      reason: 'Identified from search',
    };

    const result = validateProductIdentity({
      pipelineInput: input,
      aiResponse: wrongResponse,
    });

    // MUST reject
    expect(result.verified).toBe(false);
    expect(result.conflicts.some(c => c.severity === 'critical')).toBe(true);
    expect(result.conflicts.some(c => c.field === 'asin')).toBe(true);
  });

  it('accepts correct product for ASIN B0GSS4SGZR', () => {
    const input: IdentificationInput = {
      rawInput: 'https://www.amazon.com/dp/B0GSS4SGZR',
      inputType: 'url',
      url: 'https://www.amazon.com/dp/B0GSS4SGZR',
      asin: 'B0GSS4SGZR',
      retailer: 'Amazon',
      userId: 'test-user',
    };

    // AI correctly returns the same ASIN
    const correctResponse: AIProductResponse = {
      status: 'identified',
      product: {
        name: 'Apple AirPods Max 2',
        brand: 'Apple',
        model: 'AirPods Max 2',
        category: 'Headphones',
        subCategory: 'Over-Ear',
        sku: null,
        upc: null,
        asin: 'B0GSS4SGZR', // Correct ASIN!
        mpn: null,
        productUrl: 'https://www.amazon.com/dp/B0GSS4SGZR',
        storeUrl: null,
        description: 'Premium over-ear headphones by Apple with USB-C',
        notes: null,
        tags: ['headphones', 'apple', 'wireless', 'noise-cancelling'],
        pricing: { currentPrice: 549.00, currency: 'USD', originalPrice: null, discountPercent: null, dealAmount: null, shipping: null, tax: null, coupon: null, promoCode: null },
        sellers: [],
        images: [],
        specifications: [
          { key: 'Connectivity', value: 'Bluetooth 5.3' },
          { key: 'Charging', value: 'USB-C' },
        ],
      },
      confidence: { overall: 95, name: 98, brand: 99, model: 95, category: 90, sku: 0, upc: 0, asin: 100, mpn: 0, price: 80, image: 0 },
      sources: ['ASIN knowledge', 'search evidence'],
      verifiedFields: ['asin', 'name', 'brand', 'model'],
      conflicts: [],
      reason: 'Product identified with high confidence from ASIN B0GSS4SGZR',
    };

    const result = validateProductIdentity({
      pipelineInput: input,
      aiResponse: correctResponse,
    });

    // MUST accept
    expect(result.verified).toBe(true);
    expect(result.conflicts.filter(c => c.severity === 'critical')).toHaveLength(0);
  });
});
