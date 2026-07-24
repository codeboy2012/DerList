/**
 * Extraction Pipeline Orchestrator
 *
 * Runs all extractors in parallel, then merges results using the consensus engine.
 * This is the core of the Product Intelligence Engine.
 */

import type { ExtractionResult, PipelineInput, PipelineResult, VotableResult } from './types';
import { buildConsensus } from './consensus';
import { getParserForDomain } from '../parsers';
import {
  extractFromJsonLd,
  extractFromOpenGraph,
  extractFromMicrodata,
  extractFromHtmlHeuristic,
} from '../extractors';

/**
 * Run the full extraction pipeline on a product page.
 *
 * Steps:
 * 1. Select retailer parser (if available for domain)
 * 2. Run all extractors in parallel
 * 3. Merge results via consensus voting
 * 4. Return unified PipelineResult with confidence
 */
export async function runExtractionPipeline(input: PipelineInput): Promise<PipelineResult> {
  const { html, url, domain } = input;

  // 1. Get retailer parser (may be null for unknown domains)
  const retailerParser = getParserForDomain(domain);

  // 2. Run all extractors in parallel
  const extractorPromises: Promise<ExtractionResult>[] = [
    Promise.resolve(extractFromJsonLd(html)),
    Promise.resolve(extractFromOpenGraph(html)),
    Promise.resolve(extractFromMicrodata(html)),
    Promise.resolve(extractFromHtmlHeuristic(html, domain)),
  ];

  // Add retailer-specific parser if available
  if (retailerParser) {
    extractorPromises.push(Promise.resolve(retailerParser.extract(html, url)));
  }

  const settled = await Promise.allSettled(extractorPromises);

  // 3. Collect successful results
  const results: ExtractionResult[] = [];
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled' && outcome.value.confidence > 0) {
      results.push(outcome.value);
    }
  }

  // 4. Build consensus
  const votable: VotableResult[] = results.map((r) => ({
    price: r.price,
    currency: r.currency,
    title: r.title,
    image: r.image,
    brand: r.brand,
    confidence: r.confidence,
    source: r.source,
  }));

  const consensus = buildConsensus(votable);

  // 5. Merge remaining fields from highest-confidence extractor
  const sorted = [...results].sort((a, b) => b.confidence - a.confidence);
  const description = sorted.find((r) => r.description)?.description ?? null;
  const sku = sorted.find((r) => r.sku)?.sku ?? null;
  const mpn = sorted.find((r) => r.mpn)?.mpn ?? null;
  const gtin = sorted.find((r) => r.gtin)?.gtin ?? null;
  const inStock = sorted.find((r) => r.inStock !== null)?.inStock ?? null;
  const availability = sorted.find((r) => r.availability)?.availability ?? null;
  const gallery = sorted.find((r) => r.gallery.length > 0)?.gallery ?? [];

  // 6. Build final result
  const pipelineResult: PipelineResult = {
    title: consensus.title,
    description,
    price: consensus.price,
    currency: consensus.currency,
    image: consensus.image,
    gallery,
    brand: consensus.brand,
    sku,
    mpn,
    gtin,
    inStock,
    availability,
    retailer: retailerParser?.name ?? null,
    confidence: consensus.overallConfidence,
    priceSource: consensus.priceSource,
    needsReview: consensus.needsReview,
  };

  return pipelineResult;
}
