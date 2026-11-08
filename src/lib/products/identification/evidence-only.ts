/**
 * Evidence-only selection for AI-supplied images and prices.
 *
 * The identification prompt asks the model to return null instead of guessing,
 * but the model's output is untrusted. These helpers enforce the documented
 * contract: a value is accepted only when it is backed by page/search evidence.
 */

import { sanitizeImage } from '../validation';

export interface ImageEvidenceInput {
  searchImage?: string | null;
  partialImage?: string | null;
  aiImages: ReadonlyArray<{ url: string }>;
}

export interface PriceEvidenceInput {
  searchPrice?: number | null;
  partialPrice?: number | null;
  aiPrice?: number | null;
  aiPriceConfidence?: number;
  status?: string;
  verifiedFields?: readonly string[];
}

/**
 * Pick an image that is backed by evidence.
 *
 * Search results and extracted page metadata are evidence; AI-only image URLs
 * are not, unless the same URL also appeared in that evidence.
 */
export function selectImageFromEvidence(input: ImageEvidenceInput): string | null {
  const searchImage = sanitizeImage(input.searchImage ?? null);
  if (searchImage) return searchImage;

  const partialImage = sanitizeImage(input.partialImage ?? null);
  if (partialImage) return partialImage;

  const evidenceUrls = new Set(
    [input.searchImage, input.partialImage].filter(
      (url): url is string => typeof url === 'string' && url.length > 0
    )
  );

  for (const image of input.aiImages) {
    if (!evidenceUrls.has(image.url)) continue;
    const sanitized = sanitizeImage(image.url);
    if (sanitized) return sanitized;
  }

  return null;
}

/**
 * Pick a price that is backed by evidence.
 *
 * AI prices are accepted only when the model marked the price as verified, the
 * product was identified, and its own price confidence is reasonably high.
 */
export function selectPriceFromEvidence(input: PriceEvidenceInput): number | null {
  if (input.searchPrice != null && input.searchPrice > 0) return input.searchPrice;
  if (input.partialPrice != null && input.partialPrice > 0) return input.partialPrice;

  const verifiedFields = input.verifiedFields ?? [];
  if (
    input.aiPrice != null &&
    input.aiPrice > 0 &&
    input.status === 'identified' &&
    (input.aiPriceConfidence ?? 0) >= 70 &&
    verifiedFields.includes('price')
  ) {
    return input.aiPrice;
  }

  return null;
}
