/**
 * Product Intelligence Engine — Shared Types
 *
 * All interfaces used across the extraction pipeline, parsers, and consensus engine.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Extraction Result (returned by every extractor and parser)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standardized result returned by any extraction strategy.
 * Each extractor fills in what it can find and assigns a confidence score.
 */
export interface ExtractionResult {
  title: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  image: string | null;
  gallery: string[];
  brand: string | null;
  sku: string | null;
  mpn: string | null;
  gtin: string | null;
  inStock: boolean | null;
  availability: string | null;
  /** 0-100 confidence score for this extraction */
  confidence: number;
  /** Identifier of the extraction source (e.g., "json-ld", "amazon-parser", "opengraph") */
  source: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Input / Output
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input to the extraction pipeline.
 */
export interface PipelineInput {
  /** Raw HTML content of the product page */
  html: string;
  /** The canonical/normalized URL of the product */
  url: string;
  /** Domain extracted from the URL (e.g., "amazon.com") */
  domain: string | null;
  /** If re-importing/refreshing, the existing product for comparison */
  existingProduct?: {
    id: string;
    currentPrice: number | null;
  };
}

/**
 * Final merged result from the extraction pipeline.
 */
export interface PipelineResult {
  title: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  image: string | null;
  gallery: string[];
  brand: string | null;
  sku: string | null;
  mpn: string | null;
  gtin: string | null;
  inStock: boolean | null;
  availability: string | null;
  retailer: string | null;
  /** 0-100 overall confidence of the merged result */
  confidence: number;
  /** Which extraction source won the price vote */
  priceSource: string;
  /** True if confidence is too low and human review is recommended */
  needsReview: boolean;
  /** All price candidates considered during consensus voting */
  priceCandidates: PriceCandidateInfo[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Price Candidate (debugging / future UI)
// ─────────────────────────────────────────────────────────────────────────────

/** A single price candidate from an extractor, preserved for debugging/future UI. */
export interface PriceCandidateInfo {
  method: string;
  price: number;
  currency: string | null;
  confidence: number;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Consensus Engine Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A result that can participate in consensus voting.
 */
export interface VotableResult {
  price: number | null;
  currency: string | null;
  title: string | null;
  image: string | null;
  brand: string | null;
  confidence: number;
  source: string;
}

/**
 * Output of the consensus engine after merging all extractor votes.
 */
export interface ConsensusResult {
  price: number | null;
  currency: string | null;
  title: string | null;
  image: string | null;
  brand: string | null;
  /** 0-100 overall confidence */
  overallConfidence: number;
  /** Which source provided the winning price */
  priceSource: string;
  /** 0-1 proportion of extractors that agreed on the price */
  agreement: number;
  /** True if no clear majority — product needs human review */
  needsReview: boolean;
  /** All price candidates that participated in voting */
  priceCandidates: PriceCandidateInfo[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Retailer Parser Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interface for site-specific retailer parsers.
 * Each parser is a pure function that only works with HTML (no I/O).
 */
export interface RetailerParser {
  /** Display name (e.g., "Amazon", "Best Buy") */
  name: string;
  /** Domains this parser handles (e.g., ["amazon.com", "amazon.co.uk"]) */
  domains: string[];
  /** Extract product data from HTML using retailer-specific selectors */
  extract(html: string, url: string): ExtractionResult;
}
