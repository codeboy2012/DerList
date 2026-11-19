import { describe, expect, it } from 'vitest';
import { extractMetadata } from '@/lib/products/metadata';
import { amazonParser } from '@/lib/products/parsers/amazon';
import { bestbuyParser } from '@/lib/products/parsers/bestbuy';
import { microcenterParser } from '@/lib/products/parsers/microcenter';
import { neweggParser } from '@/lib/products/parsers/newegg';
import { targetParser } from '@/lib/products/parsers/target';
import { walmartParser } from '@/lib/products/parsers/walmart';

const malicious = '<script>alert(1)</script><b>Safe Product</b>';

describe('retailer parser text extraction', () => {
  it.each([
    ['Amazon', amazonParser, `<span id="productTitle">${malicious}</span>`],
    ['Best Buy', bestbuyParser, `<h1 class="heading-5">${malicious}</h1>`],
    ['Micro Center', microcenterParser, `<h1 id="productTitle">${malicious}</h1>`],
    ['Newegg', neweggParser, `<h1 class="product-title">${malicious}</h1>`],
    ['Target', targetParser, '<div data-test="product-title"><b>Safe Product</b></div>'],
    ['Walmart', walmartParser, `<h1 itemprop="name">${malicious}</h1>`],
  ])('%s never returns markup in the extracted title', (_name, parser, html) => {
    const result = parser.extract(html, 'https://www.amazon.com/dp/B0GSS4SGZR');
    expect(result.title).toContain('Safe Product');
    expect(result.title).not.toContain('<');
    expect(result.title).not.toContain('script');
    expect(result.title).not.toContain('alert(1)');
  });
});

describe('metadata entity handling', () => {
  it('decodes entities exactly once', () => {
    const html =
      '<html><head><title>&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;</title></head></html>';
    const metadata = extractMetadata(html);
    expect(metadata.title).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('removes a real script when extracting the title fallback', () => {
    const html = '<html><head><title>Safe <script>alert(1)</script>Product</title></head></html>';
    const metadata = extractMetadata(html);
    expect(metadata.title).toContain('Safe');
    expect(metadata.title).toContain('Product');
    expect(metadata.title).not.toContain('<script');
  });
});
