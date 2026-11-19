import { describe, expect, it } from 'vitest';
import {
  getHttpHostname,
  isGoogleEncryptedThumbnailHost,
  isHostnameForDomain,
  isUrlOnDomain,
  parseHttpUrl,
  toSafeImageSrc,
} from '@/lib/security/url';

describe('hostname matching', () => {
  it('matches exact hosts and true subdomains', () => {
    expect(isHostnameForDomain('amazon.com', 'amazon.com')).toBe(true);
    expect(isHostnameForDomain('www.amazon.com', 'amazon.com')).toBe(true);
    expect(isHostnameForDomain('smile.amazon.com.', 'amazon.com')).toBe(true);
  });

  it('rejects deceptive suffixes and lookalike registrable domains', () => {
    expect(isHostnameForDomain('amazon.com.evil.test', 'amazon.com')).toBe(false);
    expect(isHostnameForDomain('notamazon.com', 'amazon.com')).toBe(false);
    expect(isHostnameForDomain('amazon.co.uk.evil.test', 'amazon.com')).toBe(false);
    expect(isUrlOnDomain('https://amazon.com.evil.test/dp/1', 'amazon.com')).toBe(false);
    expect(isUrlOnDomain('https://notamazon.com/dp/1', 'amazon.com')).toBe(false);
  });

  it('requires HTTP(S) and rejects embedded credentials', () => {
    expect(isUrlOnDomain('https://www.amazon.com/dp/1', 'amazon.com')).toBe(true);
    expect(isUrlOnDomain('javascript:alert(1)', 'amazon.com')).toBe(false);
    expect(isUrlOnDomain('https://amazon.com@evil.test/', 'amazon.com')).toBe(false);
    expect(parseHttpUrl('ftp://example.com/')).toBeNull();
    expect(getHttpHostname('https://www.example.com/path')).toBe('www.example.com');
  });
});

describe('toSafeImageSrc', () => {
  it('allows HTTP(S), protocol-relative and same-origin paths', () => {
    expect(toSafeImageSrc('https://cdn.example.com/image.jpg')).toBe(
      'https://cdn.example.com/image.jpg'
    );
    expect(toSafeImageSrc('//cdn.example.com/image.jpg')).toBe('https://cdn.example.com/image.jpg');
    expect(toSafeImageSrc('/uploads/image.jpg')).toBe('/uploads/image.jpg');
  });

  it('rejects script, data and blob URL schemes', () => {
    expect(toSafeImageSrc('javascript:alert(1)')).toBeNull();
    expect(toSafeImageSrc('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(toSafeImageSrc('blob:https://example.com/id')).toBeNull();
    expect(toSafeImageSrc('https://user:pass@example.com/image.jpg')).toBeNull();
  });
});

describe('Google encrypted thumbnail host matching', () => {
  it('matches only the complete gstatic hostname', () => {
    expect(isGoogleEncryptedThumbnailHost('encrypted-tbn0.gstatic.com')).toBe(true);
    expect(isGoogleEncryptedThumbnailHost('encrypted-tbn12.gstatic.com')).toBe(true);
    expect(isGoogleEncryptedThumbnailHost('encrypted-tbn0.gstatic.com.evil.test')).toBe(false);
    expect(isGoogleEncryptedThumbnailHost('notencrypted-tbn0.gstatic.com')).toBe(false);
  });
});
