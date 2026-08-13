/**
 * AI Product Identification — Types
 *
 * Defines the strict structured contract between DerList and the configured
 * AI provider for product identification. The AI must return JSON that matches
 * AIProductResponse exactly — null instead of guessing.
 *
 * This is the PRIMARY identification mechanism. If no AI is configured,
 * identification is unavailable and the user must enter details manually.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Import Status — the full lifecycle of a product import
// ─────────────────────────────────────────────────────────────────────────────

export type AIImportStatus =
  | 'idle'
  | 'analyzing'
  | 'identifying'
  | 'verifying'
  | 'needs_review'
  | 'ready'
  | 'added'
  | 'failed'
  | 'no_ai_configured'
  | 'conflict';

// ─────────────────────────────────────────────────────────────────────────────
// AI Identification Status
// ─────────────────────────────────────────────────────────────────────────────

export type AIIdentificationStatus =
  | 'identified'
  | 'uncertain'
  | 'conflict'
  | 'not_found';

// ─────────────────────────────────────────────────────────────────────────────
// Field Source Tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Supported sources for each field value.
 * Tracks WHERE each piece of product data came from.
 */
export type FieldSourceType =
  | 'user'
  | 'url'
  | 'structured-data'
  | 'search'
  | 'serpapi'
  | 'brave'
  | 'keepa'
  | 'ai'
  | 'manual';

/**
 * Per-field source + confidence tracking.
 * Every important field should have a source and confidence score.
 */
export interface FieldSourceEntry {
  source: FieldSourceType;
  confidence: number;
  timestamp?: string;
}

/**
 * Complete field source map for all important product fields.
 */
export interface FieldSourceMap {
  name?: FieldSourceEntry;
  brand?: FieldSourceEntry;
  model?: FieldSourceEntry;
  category?: FieldSourceEntry;
  subCategory?: FieldSourceEntry;
  sku?: FieldSourceEntry;
  upc?: FieldSourceEntry;
  asin?: FieldSourceEntry;
  mpn?: FieldSourceEntry;
  price?: FieldSourceEntry;
  image?: FieldSourceEntry;
  description?: FieldSourceEntry;
  url?: FieldSourceEntry;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Product Response — Strict JSON the AI must return
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The EXACT structure the AI must return. This is enforced in the prompt
 * and validated after parsing. Use null instead of guessing.
 */
export interface AIProductResponse {
  status: AIIdentificationStatus;
  product: AIProductData;
  confidence: AIConfidenceScores;
  sources: string[];
  verifiedFields: string[];
  conflicts: AIConflict[];
  reason: string;
}

/**
 * Full product data structure returned by AI.
 */
export interface AIProductData {
  name: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  subCategory: string | null;
  sku: string | null;
  upc: string | null;
  asin: string | null;
  mpn: string | null;
  productUrl: string | null;
  storeUrl: string | null;
  description: string | null;
  notes: string | null;
  tags: string[];
  pricing: AIProductPricing;
  sellers: AIProductSeller[];
  images: AIProductImage[];
  specifications: AIProductSpecification[];
}

/**
 * Pricing data from AI.
 */
export interface AIProductPricing {
  currentPrice: number | null;
  currency: string | null;
  originalPrice: number | null;
  discountPercent: number | null;
  dealAmount: number | null;
  shipping: number | null;
  tax: number | null;
  coupon: string | null;
  promoCode: string | null;
}

/**
 * Seller data from AI.
 */
export interface AIProductSeller {
  name: string;
  url: string | null;
  price: number | null;
  availability: string | null;
  shipping: string | null;
}

/**
 * Image data from AI.
 */
export interface AIProductImage {
  url: string;
  source: string | null;
  confidence: number;
}

/**
 * Specification key/value pair.
 */
export interface AIProductSpecification {
  key: string;
  value: string;
}

/**
 * Per-field confidence scores from the AI.
 */
export interface AIConfidenceScores {
  overall: number;
  name: number;
  brand: number;
  model: number;
  category: number;
  sku: number;
  upc: number;
  asin: number;
  mpn: number;
  price: number;
  image: number;
}

/**
 * Conflict reported by AI when sources disagree.
 */
export interface AIConflict {
  field: string;
  sourceA: string;
  valueA: string;
  sourceB: string;
  valueB: string;
  resolution: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Identification Result — Internal pipeline result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The internal result after AI identification + validation + verification.
 * This is what the pipeline produces and the Product Editor consumes.
 */
export interface AIIdentificationResult {
  /** Overall status */
  status: AIImportStatus;
  /** Whether identification succeeded */
  success: boolean;
  /** The validated AI response (null if identification failed) */
  aiResponse: AIProductResponse | null;
  /** Field source tracking map */
  fieldSources: FieldSourceMap;
  /** Identity verification result */
  identityVerification: IdentityVerificationResult;
  /** Processing metadata */
  metadata: AIIdentificationMetadata;
  /** Human-readable message for UI */
  message: string;
  /** Detailed reason for the outcome */
  reason: string;
}

/**
 * Identity verification result — ensures the AI identified the RIGHT product.
 */
export interface IdentityVerificationResult {
  /** Whether the identity was verified */
  verified: boolean;
  /** Specific checks performed */
  checks: IdentityCheck[];
  /** Conflicts detected */
  conflicts: IdentityConflict[];
  /** Overall verification confidence */
  confidence: number;
}

export interface IdentityCheck {
  field: string;
  expected: string | null;
  actual: string | null;
  passed: boolean;
  reason: string;
}

export interface IdentityConflict {
  field: string;
  inputValue: string;
  aiValue: string;
  evidenceValue: string | null;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

/**
 * Processing metadata for AI identification.
 */
export interface AIIdentificationMetadata {
  /** AI provider used */
  provider: string | null;
  /** Model used */
  model: string | null;
  /** Tokens consumed */
  tokensUsed: number | null;
  /** Duration in ms */
  durationMs: number;
  /** Timestamp of identification */
  timestamp: string;
  /** Import method */
  importMethod: 'url' | 'name' | 'shopping-list';
  /** Import source (e.g., 'amazon', 'bestbuy', 'manual') */
  importSource: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// No AI Configured Result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returned when the user has no AI provider configured.
 * The UI must display a clear message and open the Product Editor for manual entry.
 */
export interface NoAIConfiguredResult {
  status: 'no_ai_configured';
  message: string;
  /** Any verified information from the URL (ASIN, retailer, etc.) */
  verifiedContext: {
    url: string | null;
    asin: string | null;
    retailer: string | null;
    sku: string | null;
    upc: string | null;
    mpn: string | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Identification Input — What gets sent to the AI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Context assembled for the AI identification request.
 * Contains everything the AI needs to identify the product.
 */
export interface AIIdentificationContext {
  /** Original user input */
  rawInput: string;
  /** Normalized URL (if applicable) */
  normalizedUrl: string | null;
  /** Detected retailer */
  retailer: string | null;
  /** ASIN (if Amazon) */
  asin: string | null;
  /** SKU (if available) */
  sku: string | null;
  /** UPC (if available) */
  upc: string | null;
  /** MPN (if available) */
  mpn: string | null;
  /** Search evidence already collected */
  searchEvidence: SearchEvidenceContext[];
  /** Structured metadata already collected */
  structuredMetadata: Record<string, unknown> | null;
}

/**
 * Search evidence context passed to AI for verification.
 */
export interface SearchEvidenceContext {
  title: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  url: string | null;
  retailer: string | null;
  matchedAsin: boolean;
  matchedRetailer: boolean;
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Editor Mapping — Full editor structure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete product editor draft that maps AI results to the editor UI.
 * This extends the basic ProductDraft with all extended fields.
 */
export interface FullProductEditorDraft {
  // ── Product Information ──
  productName: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  subCategory: string | null;
  sku: string | null;
  upc: string | null;
  asin: string | null;
  mpn: string | null;
  productUrl: string | null;
  storeUrl: string | null;
  description: string | null;
  notes: string | null;
  tags: string[];

  // ── Pricing ──
  currentPrice: number | null;
  originalPrice: number | null;
  currency: string | null;
  discountPercent: number | null;
  dealAmount: number | null;
  shipping: number | null;
  tax: number | null;
  coupon: string | null;
  promoCode: string | null;
  lockManualPricing: boolean;

  // ── Price Source Tracking ──
  priceSource: FieldSourceType | null;
  priceConfidence: number | null;
  priceTimestamp: string | null;

  // ── Sellers ──
  sellers: AIProductSeller[];

  // ── Images ──
  images: ProductEditorImage[];

  // ── Wishlist (user-owned, AI may suggest but NOT overwrite) ──
  priority: string | null;
  quantity: number | null;
  desiredPrice: number | null;
  purchaseStatus: string | null;
  needByDate: string | null;
  folder: string | null;
  subFolder: string | null;
  wishlistCategory: string | null;
  customLabels: string[];
  wishlistNotes: string | null;

  // ── AI Metadata ──
  aiConfidence: number | null;
  aiGeneratedTags: string[];
  aiSuggestedCategory: string | null;
  aiSuggestedName: string | null;
  specifications: AIProductSpecification[];

  // ── History / Import ──
  createdAt: string | null;
  lastUpdatedAt: string | null;
  importSource: string | null;
  importMethod: string | null;
  aiProvider: string | null;
  identificationTimestamp: string | null;
  identificationStatus: AIImportStatus;

  // ── Field Sources ──
  fieldSources: FieldSourceMap;
}

/**
 * Image in the product editor.
 */
export interface ProductEditorImage {
  url: string;
  source: FieldSourceType;
  confidence: number;
  verified: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Activity Timeline Events
// ─────────────────────────────────────────────────────────────────────────────

export type AIActivityStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface AIActivityEvent {
  id: string;
  step: string;
  status: AIActivityStatus;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Full AI activity timeline for a product identification operation.
 */
export interface AIActivityTimeline {
  operationId: string;
  events: AIActivityEvent[];
  startedAt: string;
  completedAt: string | null;
  overallStatus: AIImportStatus;
}
