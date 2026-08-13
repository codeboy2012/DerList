/**
 * Structured Data Identification Provider
 *
 * Re-runs extraction on the product page focusing specifically on structured data
 * (JSON-LD, OpenGraph, microdata) — the most reliable sources that survive
 * retailer HTML redesigns.
 *
 * This provider is tried early in the pipeline because structured data is
 * machine-readable and standardized across retailers.
 */

import { runExtractionPipeline } from '../../engine';
import { fetchProductPage } from '../../fetch';
import { extractDomain } from '../../normalize';
import { sanitizeBrand, sanitizeImage, sanitizePrice, sanitizeTitle } from '../../validation';
import type { IdentificationInput, IdentificationProvider, IdentifiedProduct } from '../types';

export class StructuredDataProvider implements IdentificationProvider {
  readonly id = 'structured-data';
  readonly name = 'Structured Page Data';
  readonly priority = 10; // Try first — most reliable

  canHandle(input: IdentificationInput): boolean {
    // Can handle URL-based inputs where we haven't already failed extraction
    // (or where we want to retry with stricter validation)
    return !!input.url && !input.directExtractionFailed;
  }

  async identify(input: IdentificationInput): Promise<IdentifiedProduct | null> {
    if (!input.url) return null;

    try {
      const fetchResult = await fetchProductPage(input.url);
      const domain = extractDomain(input.url);

      const pipeline = await runExtractionPipeline({
        html: fetchResult.html,
        url: input.url,
        domain,
      });

      // Validate extracted data
      const title = sanitizeTitle(pipeline.title);
      if (!title) return null;

      const price = sanitizePrice(pipeline.price, pipeline.priceSource, pipeline.confidence);
      const brand = sanitizeBrand(pipeline.brand, input.retailer);
      const image = sanitizeImage(pipeline.image);

      // Only return if we have at minimum a valid title and reasonable confidence
      if (pipeline.confidence < 40) return null;

      return {
        title,
        brand: brand ?? null,
        price,
        currency: pipeline.currency ?? 'USD',
        retailer: input.retailer ?? pipeline.retailer ?? null,
        url: input.url,
        imageUrl: image ?? null,
        description: pipeline.description ?? null,
        asin: input.asin ?? pipeline.sku ?? null,
        sku: pipeline.sku ?? null,
        mpn: pipeline.mpn ?? null,
        gtin: pipeline.gtin ?? null,
        upc: null,
        category: null,
        confidence: pipeline.confidence,
        source: 'structured-data',
        evidence: [
          `Extracted from page via ${pipeline.priceSource}`,
          pipeline.brand ? `Brand: ${pipeline.brand}` : null,
          pipeline.price ? `Price: $${pipeline.price} (${pipeline.priceSource})` : null,
          `Confidence: ${pipeline.confidence}%`,
        ].filter(Boolean) as string[],
        needsReview: pipeline.needsReview,
      };
    } catch {
      return null;
    }
  }
}
