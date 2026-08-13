/**
 * Tests for the Product Validation Module
 *
 * Ensures that garbage extraction results are properly rejected:
 * - Generic retailer page titles
 * - Suspicious default prices
 * - Retailer-as-brand extraction errors
 * - Placeholder/tracking images
 */
import { describe, expect, it } from 'vitest';
import {
  sanitizeBrand,
  sanitizeImage,
  sanitizePrice,
  sanitizeTitle,
  validateBrand,
  validateImage,
  validatePrice,
  validateProduct,
  validateTitle,
} from '@/lib/products/validation';

// ─────────────────────────────────────────────────────────────────────────────
// Title Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('validateTitle', () => {
  it('rejects null/undefined/empty titles', () => {
    expect(validateTitle(null).valid).toBe(false);
    expect(validateTitle(undefined).valid).toBe(false);
    expect(validateTitle('').valid).toBe(false);
    expect(validateTitle('  ').valid).toBe(false);
  });

  it('rejects very short titles', () => {
    expect(validateTitle('ab').valid).toBe(false);
    expect(validateTitle('x').valid).toBe(false);
  });

  it('rejects retailer page titles', () => {
    expect(validateTitle('Amazon.com').valid).toBe(false);
    expect(validateTitle('Amazon').valid).toBe(false);
    expect(validateTitle('amazon').valid).toBe(false);
    expect(validateTitle('Walmart').valid).toBe(false);
    expect(validateTitle('Best Buy').valid).toBe(false);
    expect(validateTitle('Target').valid).toBe(false);
    expect(validateTitle('Newegg').valid).toBe(false);
    expect(validateTitle('eBay').valid).toBe(false);
    expect(validateTitle('Home Depot').valid).toBe(false);
    expect(validateTitle('Costco').valid).toBe(false);
  });

  it('rejects generic placeholder titles', () => {
    expect(validateTitle('Home').valid).toBe(false);
    expect(validateTitle('Product').valid).toBe(false);
    expect(validateTitle('Shop').valid).toBe(false);
    expect(validateTitle('Search').valid).toBe(false);
    expect(validateTitle('Untitled Product').valid).toBe(false);
    expect(validateTitle('undefined').valid).toBe(false);
    expect(validateTitle('null').valid).toBe(false);
    expect(validateTitle('Unknown Product').valid).toBe(false);
    expect(validateTitle('Loading...').valid).toBe(false);
  });

  it('rejects error/captcha page titles', () => {
    expect(validateTitle('Page Not Found').valid).toBe(false);
    expect(validateTitle('Robot Check').valid).toBe(false);
    expect(validateTitle('Are you a robot').valid).toBe(false);
    expect(validateTitle('Access Denied').valid).toBe(false);
    expect(validateTitle('Sign In').valid).toBe(false);
    expect(validateTitle('Just a moment').valid).toBe(false);
  });

  it('rejects retailer-prefixed page titles', () => {
    expect(validateTitle('Amazon - Your Orders').valid).toBe(false);
    expect(validateTitle('Amazon: Sign In').valid).toBe(false);
    expect(validateTitle('Walmart | Shopping').valid).toBe(false);
    expect(validateTitle('Best Buy · Deals').valid).toBe(false);
  });

  it('rejects domain-only titles', () => {
    expect(validateTitle('amazon.com').valid).toBe(false);
    expect(validateTitle('bestbuy.com').valid).toBe(false);
    expect(validateTitle('walmart.com').valid).toBe(false);
  });

  it('accepts valid product titles', () => {
    expect(validateTitle('NVIDIA GeForce RTX 5060 Ti 16GB').valid).toBe(true);
    expect(validateTitle('Apple AirPods Pro 2nd Generation').valid).toBe(true);
    expect(validateTitle('Sony WH-1000XM5 Wireless Headphones').valid).toBe(true);
    expect(validateTitle('Anker USB-C Cable 6ft').valid).toBe(true);
    expect(validateTitle('Samsung 990 Pro 2TB NVMe SSD').valid).toBe(true);
    expect(validateTitle('YubiKey 5 NFC').valid).toBe(true);
    expect(validateTitle('XGIMI MoGo 2 Pro Projector').valid).toBe(true);
  });

  it('accepts titles that happen to contain retailer names', () => {
    expect(validateTitle('Amazon Echo Dot (5th Gen)').valid).toBe(true);
    expect(validateTitle('Amazon Basics USB Cable 3-pack').valid).toBe(true);
    // But the bare name should still be rejected
    expect(validateTitle('Amazon').valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Price Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('validatePrice', () => {
  it('accepts null price (price unavailable is valid)', () => {
    expect(validatePrice(null).valid).toBe(true);
    expect(validatePrice(undefined).valid).toBe(true);
  });

  it('rejects negative prices', () => {
    expect(validatePrice(-1).valid).toBe(false);
    expect(validatePrice(-99.99).valid).toBe(false);
  });

  it('rejects zero price', () => {
    expect(validatePrice(0).valid).toBe(false);
  });

  it('rejects suspicious default prices with low confidence', () => {
    expect(validatePrice(10, 'broad-regex', 30).valid).toBe(false);
    expect(validatePrice(1, 'generic-fallback', 20).valid).toBe(false);
    expect(validatePrice(10, undefined, 40).valid).toBe(false);
  });

  it('accepts suspicious prices if from high-confidence source', () => {
    // $10 is valid if JSON-LD says so with high confidence
    expect(validatePrice(10, 'json-ld-product-offer', 95).valid).toBe(true);
    expect(validatePrice(1, 'microdata-itemprop-price', 90).valid).toBe(true);
  });

  it('accepts normal prices', () => {
    expect(validatePrice(29.99).valid).toBe(true);
    expect(validatePrice(199).valid).toBe(true);
    expect(validatePrice(549.99).valid).toBe(true);
    expect(validatePrice(1299).valid).toBe(true);
    expect(validatePrice(0.99).valid).toBe(true);
  });

  it('accepts very high prices (with note)', () => {
    const result = validatePrice(150000);
    expect(result.valid).toBe(true);
    expect(result.reason).toContain('very high');
  });

  it('rejects NaN', () => {
    expect(validatePrice(NaN).valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Brand Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('validateBrand', () => {
  it('accepts null/empty brand (optional field)', () => {
    expect(validateBrand(null).valid).toBe(true);
    expect(validateBrand(undefined).valid).toBe(true);
    expect(validateBrand('').valid).toBe(true);
  });

  it('rejects brand that matches the retailer', () => {
    expect(validateBrand('Amazon', 'Amazon').valid).toBe(false);
    expect(validateBrand('Walmart', 'Walmart').valid).toBe(false);
    expect(validateBrand('Best Buy', 'Best Buy').valid).toBe(false);
    expect(validateBrand('Target', 'Target').valid).toBe(false);
  });

  it('rejects known retailer names as brands', () => {
    expect(validateBrand('Amazon', 'Best Buy').valid).toBe(false);
    expect(validateBrand('Walmart', 'Newegg').valid).toBe(false);
    expect(validateBrand('eBay', null).valid).toBe(false);
  });

  it('allows legitimate retailer store brands', () => {
    expect(validateBrand('Amazon Basics', 'Amazon').valid).toBe(true);
    expect(validateBrand('Amazon Echo', 'Amazon').valid).toBe(true);
    expect(validateBrand('Amazon Kindle', 'Amazon').valid).toBe(true);
  });

  it('rejects URL-like brands', () => {
    expect(validateBrand('https://amazon.com').valid).toBe(false);
    expect(validateBrand('www.samsung.com').valid).toBe(false);
    expect(validateBrand('nvidia.com').valid).toBe(false);
  });

  it('accepts valid brand names', () => {
    expect(validateBrand('NVIDIA').valid).toBe(true);
    expect(validateBrand('Samsung').valid).toBe(true);
    expect(validateBrand('Apple').valid).toBe(true);
    expect(validateBrand('Sony').valid).toBe(true);
    expect(validateBrand('Anker').valid).toBe(true);
    expect(validateBrand('Corsair').valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Image Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('validateImage', () => {
  it('accepts null/empty image (optional field)', () => {
    expect(validateImage(null).valid).toBe(true);
    expect(validateImage(undefined).valid).toBe(true);
    expect(validateImage('').valid).toBe(true);
  });

  it('rejects Google encrypted thumbnails', () => {
    expect(
      validateImage('https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ABC123').valid
    ).toBe(false);
    expect(
      validateImage('https://encrypted-tbn2.gstatic.com/images?q=tbn:XYZ').valid
    ).toBe(false);
  });

  it('rejects tracking pixels and spacers', () => {
    expect(validateImage('https://example.com/pixel.gif').valid).toBe(false);
    expect(validateImage('https://cdn.example.com/spacer.png').valid).toBe(false);
    expect(validateImage('https://example.com/transparent.gif').valid).toBe(false);
    expect(validateImage('https://example.com/1x1.png').valid).toBe(false);
  });

  it('rejects favicons and logos', () => {
    expect(validateImage('https://example.com/favicon.ico').valid).toBe(false);
    expect(validateImage('https://cdn.example.com/logo.png').valid).toBe(false);
    expect(validateImage('https://example.com/apple-touch-icon.png').valid).toBe(false);
  });

  it('rejects placeholder images', () => {
    expect(validateImage('https://cdn.example.com/placeholder.jpg').valid).toBe(false);
    expect(validateImage('https://example.com/no-image.png').valid).toBe(false);
    expect(validateImage('https://cdn.example.com/default_image.jpg').valid).toBe(false);
  });

  it('rejects data URIs', () => {
    expect(validateImage('data:image/png;base64,iVBOR...').valid).toBe(false);
  });

  it('accepts valid product image URLs', () => {
    expect(
      validateImage('https://m.media-amazon.com/images/I/71ABC123._AC_SX679_.jpg').valid
    ).toBe(true);
    expect(
      validateImage('https://i5.walmartimages.com/seo/product-image.jpeg').valid
    ).toBe(true);
    expect(
      validateImage('https://pisces.bbystatic.com/image2/BestBuy_US/images/products/123.jpg').valid
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full Product Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('validateProduct', () => {
  it('rejects product with "Amazon.com" as title (the original bug)', () => {
    const result = validateProduct({
      title: 'Amazon.com',
      price: 10,
      brand: null,
      image: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ABC',
      retailer: 'Amazon',
    });

    expect(result.isAcceptable).toBe(false);
    expect(result.titleValid.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('accepts a well-identified product', () => {
    const result = validateProduct({
      title: 'NVIDIA GeForce RTX 4070 Ti SUPER 16GB',
      price: 799.99,
      brand: 'NVIDIA',
      image: 'https://m.media-amazon.com/images/I/product.jpg',
      retailer: 'Amazon',
    }, 85);

    expect(result.isAcceptable).toBe(true);
    expect(result.overallConfidence).toBeGreaterThanOrEqual(75);
    expect(result.issues.length).toBe(0);
  });

  it('reduces confidence when price is suspicious', () => {
    const good = validateProduct({
      title: 'Samsung 990 Pro 2TB NVMe SSD',
      price: 179.99,
      retailer: 'Amazon',
    }, 80);

    const suspicious = validateProduct({
      title: 'Samsung 990 Pro 2TB NVMe SSD',
      price: 10,
      retailer: 'Amazon',
    }, 80);

    // Both titles are valid, but suspicious price should lower confidence
    expect(good.overallConfidence).toBeGreaterThan(suspicious.overallConfidence);
  });

  it('accepts products with missing price (price unavailable)', () => {
    const result = validateProduct({
      title: 'Sony WH-1000XM5',
      price: null,
      brand: 'Sony',
      retailer: 'Amazon',
    }, 70);

    expect(result.isAcceptable).toBe(true);
    expect(result.priceValid.valid).toBe(true);
  });

  it('flags multiple issues simultaneously', () => {
    const result = validateProduct({
      title: 'Amazon',
      price: 0,
      brand: 'Amazon',
      image: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ABC',
      retailer: 'Amazon',
    });

    expect(result.isAcceptable).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sanitize Helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('sanitize helpers', () => {
  it('sanitizeTitle returns null for invalid titles', () => {
    expect(sanitizeTitle('Amazon.com')).toBe(null);
    expect(sanitizeTitle(null)).toBe(null);
    expect(sanitizeTitle('')).toBe(null);
  });

  it('sanitizeTitle returns trimmed title for valid titles', () => {
    expect(sanitizeTitle(' RTX 5060 Ti ')).toBe('RTX 5060 Ti');
  });

  it('sanitizePrice returns null for invalid prices', () => {
    expect(sanitizePrice(0)).toBe(null);
    expect(sanitizePrice(-5)).toBe(null);
    expect(sanitizePrice(10, 'broad-regex', 20)).toBe(null);
  });

  it('sanitizePrice returns price for valid prices', () => {
    expect(sanitizePrice(199.99)).toBe(199.99);
    expect(sanitizePrice(null)).toBe(null);
  });

  it('sanitizeBrand returns null when brand matches retailer', () => {
    expect(sanitizeBrand('Amazon', 'Amazon')).toBe(null);
    expect(sanitizeBrand('Walmart', 'Walmart')).toBe(null);
  });

  it('sanitizeBrand returns brand for valid brands', () => {
    expect(sanitizeBrand('NVIDIA', 'Amazon')).toBe('NVIDIA');
    expect(sanitizeBrand('Amazon Basics', 'Amazon')).toBe('Amazon Basics');
  });

  it('sanitizeImage rejects Google thumbnails', () => {
    expect(sanitizeImage('https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ABC')).toBe(null);
  });

  it('sanitizeImage accepts valid images', () => {
    expect(sanitizeImage('https://m.media-amazon.com/images/I/71ABC._AC_SX679_.jpg'))
      .toBe('https://m.media-amazon.com/images/I/71ABC._AC_SX679_.jpg');
  });
});
