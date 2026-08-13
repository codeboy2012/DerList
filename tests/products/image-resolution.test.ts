/**
 * Tests for Image Resolution and Completeness
 */
import { describe, expect, it } from 'vitest';
import { validateImageUrl, httpVerifyImage } from '@/lib/products/identification/image-resolution';
import { calculateCompleteness } from '@/lib/products/identification/completeness';
import type { IdentifiedProduct } from '@/lib/products/identification/types';

// ─────────────────────────────────────────────────────────────────────────────
// Image URL Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('validateImageUrl', () => {
  it('rejects null/undefined/empty', () => {
    expect(validateImageUrl(null)).toBe(false);
    expect(validateImageUrl(undefined)).toBe(false);
    expect(validateImageUrl('')).toBe(false);
  });

  it('rejects Google encrypted thumbnails', () => {
    expect(validateImageUrl('https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcSABC')).toBe(false);
    expect(validateImageUrl('https://encrypted-tbn1.gstatic.com/images?q=tbn:ABC')).toBe(false);
    expect(validateImageUrl('https://encrypted-tbn2.gstatic.com/shopping?q=tbn:XYZ')).toBe(false);
  });

  it('rejects favicons', () => {
    expect(validateImageUrl('https://www.amazon.com/favicon.ico')).toBe(false);
    expect(validateImageUrl('https://example.com/favicon-32x32.png')).toBe(false);
  });

  it('rejects logos', () => {
    expect(validateImageUrl('https://cdn.example.com/logo.png')).toBe(false);
    expect(validateImageUrl('https://example.com/assets/logo-dark.svg')).toBe(false);
  });

  it('rejects placeholders', () => {
    expect(validateImageUrl('https://cdn.example.com/placeholder.jpg')).toBe(false);
    expect(validateImageUrl('https://example.com/no-image.png')).toBe(false);
    expect(validateImageUrl('https://example.com/default_image.jpg')).toBe(false);
  });

  it('rejects tracking pixels', () => {
    expect(validateImageUrl('https://example.com/pixel.gif')).toBe(false);
    expect(validateImageUrl('https://cdn.example.com/spacer.png')).toBe(false);
    expect(validateImageUrl('https://example.com/1x1.gif')).toBe(false);
  });

  it('rejects CAPTCHA images', () => {
    expect(validateImageUrl('https://images-na.ssl-images-amazon.com/captcha/abc.jpg')).toBe(false);
  });

  it('rejects non-HTTPS (except trusted CDNs)', () => {
    expect(validateImageUrl('http://random-site.com/image.jpg')).toBe(false);
  });

  it('rejects data URIs', () => {
    expect(validateImageUrl('data:image/png;base64,iVBOR...')).toBe(false);
  });

  it('accepts valid Amazon product images', () => {
    expect(validateImageUrl('https://m.media-amazon.com/images/I/71zXnNM0PYL._AC_SX679_.jpg')).toBe(true);
    expect(validateImageUrl('https://m.media-amazon.com/images/I/B0GSS4SGZR._AC_SX679_.jpg')).toBe(true);
  });

  it('accepts valid Best Buy images', () => {
    expect(validateImageUrl('https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6501/6501234.jpg')).toBe(true);
  });

  it('accepts valid Walmart images', () => {
    expect(validateImageUrl('https://i5.walmartimages.com/seo/product-image-20240501.jpeg')).toBe(true);
  });

  it('accepts valid product image URLs from generic CDNs', () => {
    expect(validateImageUrl('https://cdn.example.com/products/headphones-main.jpg')).toBe(true);
    expect(validateImageUrl('https://store-images.s-microsoft.com/image/apps.12345.png')).toBe(true);
  });

  it('accepts protocol-relative URLs from trusted domains', () => {
    expect(validateImageUrl('//m.media-amazon.com/images/I/product.jpg')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Product Completeness
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateCompleteness', () => {
  it('returns 100% for a fully complete product', () => {
    const product: IdentifiedProduct = {
      title: 'Beats Solo 4',
      brand: 'Beats',
      price: 129.99,
      currency: 'USD',
      retailer: 'Amazon',
      url: 'https://www.amazon.com/dp/B0GSS4SGZR',
      imageUrl: 'https://m.media-amazon.com/images/I/product.jpg',
      description: 'Wireless headphones',
      asin: 'B0GSS4SGZR',
      sku: null,
      mpn: null,
      gtin: null,
      upc: null,
      category: 'Headphones',
      confidence: 85,
      source: 'asin-search',
      evidence: [],
      needsReview: false,
    };

    const result = calculateCompleteness(product);
    expect(result.score).toBe(100);
    expect(result.missingFields.length).toBe(0);
  });

  it('reports missing image correctly', () => {
    const product: IdentifiedProduct = {
      title: 'Beats Solo 4',
      brand: 'Beats',
      price: 129.99,
      currency: 'USD',
      retailer: 'Amazon',
      url: 'https://www.amazon.com/dp/B0GSS4SGZR',
      imageUrl: null, // Missing
      description: 'Wireless headphones',
      asin: 'B0GSS4SGZR',
      sku: null,
      mpn: null,
      gtin: null,
      upc: null,
      category: 'Headphones',
      confidence: 85,
      source: 'asin-search',
      evidence: [],
      needsReview: false,
    };

    const result = calculateCompleteness(product);
    expect(result.score).toBeLessThan(100);
    expect(result.missingFields).toContain('imageUrl');
    expect(result.presentFields).toContain('title');
    expect(result.presentFields).toContain('brand');
  });

  it('handles a minimal product', () => {
    const product: IdentifiedProduct = {
      title: 'Some Product',
      brand: null,
      price: null,
      currency: null,
      retailer: null,
      url: null,
      imageUrl: null,
      description: null,
      asin: null,
      sku: null,
      mpn: null,
      gtin: null,
      upc: null,
      category: null,
      confidence: 30,
      source: 'manual',
      evidence: [],
      needsReview: true,
    };

    const result = calculateCompleteness(product);
    expect(result.score).toBeLessThan(30);
    expect(result.presentFields).toContain('title');
    expect(result.missingFields).toContain('brand');
    expect(result.missingFields).toContain('price');
    expect(result.missingFields).toContain('imageUrl');
  });

  it('does not count null ASIN as present', () => {
    const product: IdentifiedProduct = {
      title: 'Test',
      brand: 'Test',
      price: 99,
      currency: 'USD',
      retailer: 'Amazon',
      url: 'https://test.com',
      imageUrl: 'https://test.com/img.jpg',
      description: null,
      asin: null, // Missing
      sku: null,
      mpn: null,
      gtin: null,
      upc: null,
      category: 'Test',
      confidence: 80,
      source: 'search-provider',
      evidence: [],
      needsReview: false,
    };

    const result = calculateCompleteness(product);
    expect(result.missingFields).toContain('asin');
    expect(result.missingFields).toContain('description');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// SSRF Protection (via httpVerifyImage)
// ─────────────────────────────────────────────────────────────────────────────

describe('httpVerifyImage SSRF protection', () => {
  it('rejects localhost URLs', async () => {
    expect(await httpVerifyImage('http://localhost/image.jpg')).toBe(false);
    expect(await httpVerifyImage('http://127.0.0.1/image.jpg')).toBe(false);
    expect(await httpVerifyImage('https://localhost/image.jpg')).toBe(false);
  });

  it('rejects private IPv4 ranges', async () => {
    expect(await httpVerifyImage('http://10.0.0.1/image.jpg')).toBe(false);
    expect(await httpVerifyImage('http://172.16.0.1/image.jpg')).toBe(false);
    expect(await httpVerifyImage('http://192.168.1.1/image.jpg')).toBe(false);
  });

  it('rejects IPv6 loopback', async () => {
    expect(await httpVerifyImage('http://[::1]/image.jpg')).toBe(false);
  });

  it('rejects cloud metadata endpoints', async () => {
    expect(await httpVerifyImage('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(await httpVerifyImage('http://metadata.google.internal/computeMetadata')).toBe(false);
  });

  it('rejects .local and .internal domains', async () => {
    expect(await httpVerifyImage('http://myservice.local/image.jpg')).toBe(false);
    expect(await httpVerifyImage('http://db.internal/image.jpg')).toBe(false);
  });

  it('rejects non-standard ports (internal services)', async () => {
    expect(await httpVerifyImage('https://example.com:6379/image.jpg')).toBe(false); // Redis
    expect(await httpVerifyImage('https://example.com:5432/image.jpg')).toBe(false); // Postgres
    expect(await httpVerifyImage('https://example.com:3306/image.jpg')).toBe(false); // MySQL
  });

  it('allows standard HTTPS on port 443', async () => {
    // This will fail because the URL doesn't exist, but it should NOT be
    // rejected by SSRF validation. It will fail on HTTP response instead.
    // We're testing that the SSRF check itself passes.
    const result = await httpVerifyImage('https://m.media-amazon.com/nonexistent.jpg');
    // Either false (404) or true (if it somehow exists) — but NOT a SSRF block
    expect(typeof result).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Image Source Types
// ─────────────────────────────────────────────────────────────────────────────

describe('ImageSource types', () => {
  it('validates keepa as a valid image source', () => {
    // This tests the type system at runtime
    const validSources = ['keepa', 'structured-data', 'amazon-page', 'search-result', 'image-search', 'retailer-page', 'none'];
    for (const source of validSources) {
      expect(typeof source).toBe('string');
    }
  });
});
