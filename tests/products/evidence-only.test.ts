import { describe, expect, it } from 'vitest';
import {
  selectImageFromEvidence,
  selectPriceFromEvidence,
} from '@/lib/products/identification/evidence-only';

const IMAGE_A = 'https://m.media-amazon.com/images/I/aaaaaaaa.jpg';
const IMAGE_B = 'https://m.media-amazon.com/images/I/bbbbbbbb.jpg';

describe('selectImageFromEvidence', () => {
  it('prefers a validated search-result image', () => {
    expect(
      selectImageFromEvidence({
        searchImage: IMAGE_A,
        partialImage: IMAGE_B,
        aiImages: [],
      })
    ).toBe(IMAGE_A);
  });

  it('uses extracted page metadata before AI-only images', () => {
    expect(
      selectImageFromEvidence({
        partialImage: IMAGE_A,
        aiImages: [{ url: IMAGE_B }],
      })
    ).toBe(IMAGE_A);
  });

  it('rejects an AI image that does not appear in evidence', () => {
    expect(
      selectImageFromEvidence({
        aiImages: [{ url: IMAGE_B }],
      })
    ).toBeNull();
  });

  it('accepts an AI image when the same URL is in evidence', () => {
    expect(
      selectImageFromEvidence({
        partialImage: IMAGE_A,
        aiImages: [{ url: IMAGE_A }],
      })
    ).toBe(IMAGE_A);
  });
});

describe('selectPriceFromEvidence', () => {
  it('prefers search and page prices over the model', () => {
    expect(
      selectPriceFromEvidence({
        searchPrice: 99.99,
        partialPrice: 89.99,
        aiPrice: 79.99,
        aiPriceConfidence: 99,
        status: 'identified',
        verifiedFields: ['price'],
      })
    ).toBe(99.99);

    expect(
      selectPriceFromEvidence({
        partialPrice: 89.99,
        aiPrice: 79.99,
        aiPriceConfidence: 99,
        status: 'identified',
        verifiedFields: ['price'],
      })
    ).toBe(89.99);
  });

  it('rejects an AI price unless the model verified that field', () => {
    expect(
      selectPriceFromEvidence({
        aiPrice: 79.99,
        aiPriceConfidence: 95,
        status: 'identified',
        verifiedFields: [],
      })
    ).toBeNull();
  });

  it('rejects low-confidence or uncertain AI prices', () => {
    expect(
      selectPriceFromEvidence({
        aiPrice: 79.99,
        aiPriceConfidence: 40,
        status: 'identified',
        verifiedFields: ['price'],
      })
    ).toBeNull();

    expect(
      selectPriceFromEvidence({
        aiPrice: 79.99,
        aiPriceConfidence: 95,
        status: 'uncertain',
        verifiedFields: ['price'],
      })
    ).toBeNull();
  });

  it('accepts a verified, high-confidence AI price', () => {
    expect(
      selectPriceFromEvidence({
        aiPrice: 79.99,
        aiPriceConfidence: 85,
        status: 'identified',
        verifiedFields: ['price'],
      })
    ).toBe(79.99);
  });
});
