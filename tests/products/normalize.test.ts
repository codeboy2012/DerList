/**
 * Tests for URL normalization and retailer detection
 */
import { describe, expect, it } from 'vitest';
import { extractDomain, getRetailerName, normalizeUrl } from '@/lib/products/normalize';

describe('extractDomain', () => {
  it('extracts bare domain from URL', () => {
    expect(extractDomain('https://www.amazon.com/dp/B0GSS4SGZR')).toBe('amazon.com');
    expect(extractDomain('https://www.bestbuy.com/site/product')).toBe('bestbuy.com');
    expect(extractDomain('https://www.walmart.com/ip/123')).toBe('walmart.com');
  });

  it('removes www prefix', () => {
    expect(extractDomain('https://www.newegg.com/product')).toBe('newegg.com');
  });

  it('handles international domains', () => {
    expect(extractDomain('https://www.amazon.co.uk/dp/B0GSS4SGZR')).toBe('amazon.co.uk');
    expect(extractDomain('https://www.amazon.de/dp/B0GSS4SGZR')).toBe('amazon.de');
  });

  it('returns null for invalid URLs', () => {
    expect(extractDomain('not-a-url')).toBe(null);
    expect(extractDomain('')).toBe(null);
  });
});

describe('getRetailerName', () => {
  it('maps known domains to retailer names', () => {
    expect(getRetailerName('amazon.com')).toBe('Amazon');
    expect(getRetailerName('amazon.co.uk')).toBe('Amazon UK');
    expect(getRetailerName('walmart.com')).toBe('Walmart');
    expect(getRetailerName('bestbuy.com')).toBe('Best Buy');
    expect(getRetailerName('newegg.com')).toBe('Newegg');
    expect(getRetailerName('bhphotovideo.com')).toBe('B&H Photo');
    expect(getRetailerName('target.com')).toBe('Target');
    expect(getRetailerName('homedepot.com')).toBe('Home Depot');
    expect(getRetailerName('lowes.com')).toBe("Lowe's");
    expect(getRetailerName('costco.com')).toBe('Costco');
    expect(getRetailerName('aliexpress.com')).toBe('AliExpress');
    expect(getRetailerName('ebay.com')).toBe('eBay');
  });

  it('returns null for unknown domains', () => {
    expect(getRetailerName('unknownstore.com')).toBe(null);
    expect(getRetailerName(null)).toBe(null);
  });
});

describe('normalizeUrl', () => {
  it('removes tracking parameters', () => {
    const cleaned = normalizeUrl(
      'https://www.amazon.com/dp/B0GSS4SGZR?tag=affiliate-20&ref=sr_1_1&utm_source=google'
    );
    expect(cleaned).not.toContain('tag=');
    expect(cleaned).not.toContain('ref=');
    expect(cleaned).not.toContain('utm_source=');
  });

  it('normalizes to https', () => {
    const cleaned = normalizeUrl('http://www.amazon.com/dp/B0GSS4SGZR');
    expect(cleaned).toContain('https://');
  });

  it('removes hash fragments', () => {
    const cleaned = normalizeUrl('https://www.amazon.com/dp/B0GSS4SGZR#reviews');
    expect(cleaned).not.toContain('#reviews');
  });

  it('lowercases hostname', () => {
    const cleaned = normalizeUrl('https://WWW.AMAZON.COM/dp/B0GSS4SGZR');
    expect(cleaned).toContain('www.amazon.com');
  });

  it('returns null for invalid URLs', () => {
    expect(normalizeUrl('not-a-url')).toBe(null);
    expect(normalizeUrl('')).toBe(null);
    expect(normalizeUrl('ftp://files.example.com')).toBe(null);
  });

  it('preserves important path segments', () => {
    const cleaned = normalizeUrl('https://www.amazon.com/dp/B0GSS4SGZR');
    expect(cleaned).toContain('/dp/B0GSS4SGZR');
  });
});
