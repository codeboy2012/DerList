/**
 * Product Identification Pipeline — Types
 *
 * Shared types for the multi-source identification system.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Identification Result
// ─────────────────────────────────────────────────────────────────────────────

export interface IdentifiedProduct {
  title: string;
  brand: string | null;
  price: number | null;
  currency: string | null;
  retailer: string | null;
  url: string | null;
  imageUrl: string | null;
  description: string | null;
  asin: string | null;
  sku: string | null;
  mpn: string | null;
  gtin: string | null;
  upc: string | null;
  category: string | null;
  confidence: number;
  source: IdentificationSource;
  evidence: string[];
  needsReview: boolean;
  /** Per-field source tracking */
  fieldSources?: FieldSources;
}

/** Tracks which provider/source supplied each field */
export interface FieldSources {
  titleSource?: string;
  brandSource?: string;
  priceSource?: string;
  imageSource?: string;
  categorySource?: string;
  urlSource?: string;
  descriptionSource?: string;
}

export type IdentificationSource =
  | 'direct-extraction'
  | 'structured-data'
  | 'retailer-parser'
  | 'search-provider'
  | 'asin-search'
  | 'ai-identification'
  | 'manual';

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Input
// ─────────────────────────────────────────────────────────────────────────────

export interface IdentificationInput {
  /** Raw user input (URL, product name, or text) */
  rawInput: string;
  /** Detected type of input */
  inputType: 'url' | 'product-name' | 'shopping-list';
  /** URL (if input is a URL) */
  url?: string;
  /** ASIN (if detected from Amazon URL) */
  asin?: string;
  /** Retailer (if detected from URL domain) */
  retailer?: string;
  /** Country/region for localized searches */
  country?: string;
  /** User ID for accessing provider configurations */
  userId: string;
  /** Whether direct extraction already failed */
  directExtractionFailed?: boolean;
  /** Reason for failure if direct extraction failed */
  failureReason?: string;
  /** Any partial data already extracted (even if invalid) */
  partialData?: Partial<IdentifiedProduct>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Result
// ─────────────────────────────────────────────────────────────────────────────

export interface IdentificationResult {
  success: boolean;
  product: IdentifiedProduct | null;
  /** All providers that were attempted */
  providersAttempted: ProviderAttempt[];
  /** Human-readable status message for the UI */
  statusMessage: string;
  /** Whether the user should manually review */
  needsReview: boolean;
  /** Processing time in ms */
  durationMs: number;
  /** 0-100 completeness score (how many fields are filled) */
  completeness: number;
  /** Current import status for UI display */
  importStatus: ImportStatus;
  /** Per-stage timing for performance tracking */
  timing?: StageTiming;
}

export type ImportStatus =
  | 'identifying'
  | 'searching'
  | 'ai_enriching'
  | 'resolving_image'
  | 'validating'
  | 'ready'
  | 'needs_review'
  | 'failed';

export interface StageTiming {
  searchMs?: number;
  aiMs?: number;
  imageMs?: number;
  validationMs?: number;
  totalMs: number;
}

export interface ProviderAttempt {
  provider: string;
  success: boolean;
  confidence: number;
  durationMs: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Identification Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IdentificationProvider {
  /** Unique identifier */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Priority (lower = tried first) */
  readonly priority: number;

  /**
   * Can this provider handle this identification request?
   * Return false to skip (e.g., AI provider when no AI is configured).
   */
  canHandle(input: IdentificationInput): boolean;

  /**
   * Attempt to identify the product.
   * Returns null if identification fails.
   */
  identify(input: IdentificationInput): Promise<IdentifiedProduct | null>;
}
