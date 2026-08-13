/**
 * Product Completeness Scoring
 *
 * Separate from confidence (which measures "how sure we are this is the right product"),
 * completeness measures "how much useful product data do we have".
 *
 * A product can be highly confident (we're sure it's the right one) but incomplete
 * (missing image, category, description).
 */

import type { IdentifiedProduct } from './types';

export interface CompletenessReport {
  /** 0-100 score */
  score: number;
  /** Fields that are present and valid */
  presentFields: string[];
  /** Fields that are missing */
  missingFields: string[];
  /** Human-readable summary */
  summary: string;
}

/** Field weights for completeness calculation */
const FIELD_WEIGHTS: Record<string, number> = {
  title: 20,
  brand: 12,
  price: 15,
  imageUrl: 15,
  category: 8,
  retailer: 8,
  asin: 7,
  url: 7,
  description: 5,
  currency: 3,
};

/**
 * Calculate completeness score for an identified product.
 */
export function calculateCompleteness(product: IdentifiedProduct): CompletenessReport {
  const presentFields: string[] = [];
  const missingFields: string[] = [];
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    totalWeight += weight;
    const value = (product as any)[field];

    if (value != null && value !== '' && value !== 0) {
      presentFields.push(field);
      earnedWeight += weight;
    } else {
      missingFields.push(field);
    }
  }

  const score = Math.round((earnedWeight / totalWeight) * 100);

  let summary: string;
  if (score >= 90) {
    summary = 'Complete product data';
  } else if (score >= 70) {
    summary = `Good data (missing: ${missingFields.join(', ')})`;
  } else if (score >= 50) {
    summary = `Partial data (missing: ${missingFields.join(', ')})`;
  } else {
    summary = `Incomplete (missing: ${missingFields.join(', ')})`;
  }

  return { score, presentFields, missingFields, summary };
}
