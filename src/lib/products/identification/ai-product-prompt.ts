/**
 * AI Product Identification — Prompt Builder
 *
 * Assembles the strict product-identification prompt sent to the user's
 * configured AI provider. The prompt enforces:
 *
 * 1. Exact JSON schema compliance
 * 2. null instead of guessing
 * 3. ASIN identity matching
 * 4. Source conflict reporting
 * 5. No fabrication of prices, images, URLs, identifiers
 *
 * The AI receives ALL available context: URL, identifiers, search evidence,
 * structured metadata. It must identify the EXACT product — never substitute
 * a similar one.
 */

import type {
  AIIdentificationContext,
  AIProductResponse,
  SearchEvidenceContext,
} from './ai-identification-types';

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt — The strict identification instruction
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are identifying a real retail product for DerList, a shopping wishlist application.

TASK:
Look up and identify the EXACT product represented by the supplied URL and identifiers.

CRITICAL RULES:
1. Do NOT guess. If you cannot verify information, return null for that field.
2. Do NOT substitute a similar product. The exact product identity must match the supplied identifiers.
3. Do NOT return a product merely because a search result contains the same keyword.
4. The exact product identity must match the supplied identifiers (especially ASIN).
5. If information cannot be verified, return null.
6. Never invent prices, images, UPCs, SKUs, ASINs, MPNs, specifications, or URLs.
7. Return ONLY valid JSON matching the requested schema. No markdown, no code fences, no explanation outside the JSON.
8. If sources disagree about the product identity, report the conflict instead of choosing one arbitrarily.

ASIN RULES (Amazon products):
- The ASIN is a critical identity field.
- You MUST identify the product associated with that EXACT ASIN.
- You must NOT return a different product merely because a search result incorrectly associates the ASIN with another product.
- If you cannot identify the product for the given ASIN with confidence, set status to "not_found".

PRICE RULES:
- Never invent a price.
- Only include a price if you can verify it from the provided evidence or your training data.
- If unsure, set currentPrice to null.

IMAGE RULES:
- Never invent or construct image URLs.
- Only include image URLs that appear in the provided evidence.
- Never construct Amazon image URLs from ASINs.

CONFIDENCE SCALE:
- 90-100: Certain identification, ASIN recognized, product details verified
- 70-89: High confidence, strong evidence alignment
- 50-69: Moderate confidence, some fields uncertain
- 30-49: Low confidence, limited evidence
- 0-29: Very uncertain, mostly inference

You MUST return ONLY the following JSON structure:`;

// ─────────────────────────────────────────────────────────────────────────────
// JSON Schema (included in prompt for the AI)
// ─────────────────────────────────────────────────────────────────────────────

const RESPONSE_SCHEMA = `{
  "status": "identified | uncertain | conflict | not_found",
  "product": {
    "name": "string or null",
    "brand": "string or null",
    "model": "string or null",
    "category": "string or null",
    "subCategory": "string or null",
    "sku": "string or null",
    "upc": "string or null",
    "asin": "string or null (MUST match input ASIN if provided)",
    "mpn": "string or null",
    "productUrl": "string or null",
    "storeUrl": "string or null",
    "description": "string or null (1-2 sentences max)",
    "notes": "string or null",
    "tags": ["array of relevant tags"],
    "pricing": {
      "currentPrice": "number or null (ONLY if verifiable)",
      "currency": "string or null (e.g. USD)",
      "originalPrice": "number or null",
      "discountPercent": "number or null",
      "dealAmount": "number or null",
      "shipping": "number or null",
      "tax": "number or null",
      "coupon": "string or null",
      "promoCode": "string or null"
    },
    "sellers": [{"name": "string", "url": "string or null", "price": "number or null", "availability": "string or null", "shipping": "string or null"}],
    "images": [{"url": "string (ONLY from evidence)", "source": "string or null", "confidence": "number 0-100"}],
    "specifications": [{"key": "string", "value": "string"}]
  },
  "confidence": {
    "overall": "number 0-100",
    "name": "number 0-100",
    "brand": "number 0-100",
    "model": "number 0-100",
    "category": "number 0-100",
    "sku": "number 0-100",
    "upc": "number 0-100",
    "asin": "number 0-100",
    "mpn": "number 0-100",
    "price": "number 0-100",
    "image": "number 0-100"
  },
  "sources": ["array of source descriptions used for identification"],
  "verifiedFields": ["array of field names that are verified against evidence"],
  "conflicts": [
    {
      "field": "string",
      "sourceA": "string",
      "valueA": "string",
      "sourceB": "string",
      "valueB": "string",
      "resolution": "string or null"
    }
  ],
  "reason": "Brief explanation of how you identified this product and confidence level"
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Builder — Assembles the user message with all context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the complete system prompt for AI product identification.
 * This is a constant instruction — the same for every request.
 */
export function buildSystemPrompt(): string {
  return `${SYSTEM_PROMPT}\n\n${RESPONSE_SCHEMA}`;
}

/**
 * Build the user message containing all identification context.
 * This is unique per request and contains all available evidence.
 */
export function buildIdentificationPrompt(context: AIIdentificationContext): string {
  const sections: string[] = [];

  // ── Header ──
  sections.push('=== PRODUCT IDENTIFICATION REQUEST ===');
  sections.push('');

  // ── Original Input ──
  sections.push(`Original user input: ${context.rawInput}`);
  sections.push('');

  // ── Identifiers ──
  sections.push('--- IDENTIFIERS ---');
  if (context.normalizedUrl) {
    sections.push(`Normalized URL: ${context.normalizedUrl}`);
  }
  if (context.retailer) {
    sections.push(`Retailer: ${context.retailer}`);
  }
  if (context.asin) {
    sections.push(`ASIN: ${context.asin}`);
    sections.push(`IMPORTANT: The product MUST match this ASIN exactly.`);
  }
  if (context.sku) {
    sections.push(`SKU: ${context.sku}`);
  }
  if (context.upc) {
    sections.push(`UPC: ${context.upc}`);
  }
  if (context.mpn) {
    sections.push(`MPN: ${context.mpn}`);
  }
  sections.push('');

  // ── Search Evidence ──
  if (context.searchEvidence.length > 0) {
    sections.push('--- SEARCH EVIDENCE ---');
    sections.push(`${context.searchEvidence.length} search result(s) found:`);
    sections.push('');

    for (let i = 0; i < context.searchEvidence.length; i++) {
      const evidence = context.searchEvidence[i];
      sections.push(`[Result ${i + 1}]`);
      if (evidence.title) sections.push(`  Title: ${evidence.title}`);
      if (evidence.brand) sections.push(`  Brand: ${evidence.brand}`);
      if (evidence.price != null) sections.push(`  Price: ${evidence.price} ${evidence.currency ?? 'USD'}`);
      if (evidence.url) sections.push(`  URL: ${evidence.url}`);
      if (evidence.retailer) sections.push(`  Retailer: ${evidence.retailer}`);
      sections.push(`  ASIN match: ${evidence.matchedAsin ? 'YES' : 'NO'}`);
      sections.push(`  Retailer match: ${evidence.matchedRetailer ? 'YES' : 'NO'}`);
      sections.push(`  Result confidence: ${Math.round(evidence.confidence * 100)}%`);
      sections.push('');
    }
    sections.push('--- END SEARCH EVIDENCE ---');
    sections.push('');
  }

  // ── Structured Metadata ──
  if (context.structuredMetadata && Object.keys(context.structuredMetadata).length > 0) {
    sections.push('--- STRUCTURED METADATA ---');
    const meta = context.structuredMetadata;
    if (meta.title) sections.push(`  Page title: ${meta.title}`);
    if (meta.brand) sections.push(`  Detected brand: ${meta.brand}`);
    if (meta.description) {
      const desc = String(meta.description);
      sections.push(`  Description: ${desc.substring(0, 300)}`);
    }
    if (meta.price) sections.push(`  Extracted price: ${meta.price}`);
    if (meta.image) sections.push(`  Page image: ${meta.image}`);
    sections.push('--- END STRUCTURED METADATA ---');
    sections.push('');
  }

  // ── Instructions ──
  sections.push('--- INSTRUCTIONS ---');
  if (context.asin) {
    sections.push(`Identify the EXACT product with ASIN ${context.asin}.`);
    sections.push('The returned product.asin MUST equal the input ASIN.');
    sections.push('If you cannot identify this specific product, set status to "not_found".');
  } else if (context.normalizedUrl) {
    sections.push('Identify the exact product at the given URL.');
  } else {
    sections.push('Identify the product described by the user input.');
  }

  if (context.searchEvidence.length > 0) {
    sections.push('');
    sections.push('Use search evidence to VERIFY your identification, not as the sole source.');
    sections.push('If search results conflict with the ASIN identity, report the conflict.');
  }

  sections.push('');
  sections.push('Return ONLY the JSON response. No other text.');

  return sections.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Assembly — Gather all evidence into AIIdentificationContext
// ─────────────────────────────────────────────────────────────────────────────

export interface ContextAssemblyInput {
  rawInput: string;
  url?: string;
  asin?: string;
  sku?: string;
  upc?: string;
  mpn?: string;
  retailer?: string;
  /** Search evidence from prior pipeline stages */
  searchEvidence?: SearchEvidenceForContext[];
  /** Structured metadata from page extraction */
  structuredMetadata?: Record<string, unknown>;
}

export interface SearchEvidenceForContext {
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

/**
 * Assemble the full AI identification context from pipeline state.
 * Normalizes and sanitizes all inputs before sending to the AI.
 */
export function assembleIdentificationContext(
  input: ContextAssemblyInput,
): AIIdentificationContext {
  // Normalize URL
  const normalizedUrl = input.url ? sanitizeUrlForPrompt(input.url) : null;

  // Convert search evidence
  const searchEvidence: SearchEvidenceContext[] = (input.searchEvidence ?? [])
    .slice(0, 5) // Limit to top 5 results to avoid token bloat
    .map((e) => ({
      title: e.title ? truncate(e.title, 200) : null,
      brand: e.brand ? truncate(e.brand, 100) : null,
      price: e.price,
      currency: e.currency,
      url: e.url ? sanitizeUrlForPrompt(e.url) : null,
      retailer: e.retailer ? truncate(e.retailer, 50) : null,
      matchedAsin: e.matchedAsin,
      matchedRetailer: e.matchedRetailer,
      confidence: e.confidence,
    }));

  // Sanitize structured metadata
  const structuredMetadata = input.structuredMetadata
    ? sanitizeMetadataForPrompt(input.structuredMetadata)
    : null;

  return {
    rawInput: truncate(input.rawInput, 500),
    normalizedUrl,
    retailer: input.retailer ?? null,
    asin: input.asin ?? null,
    sku: input.sku ?? null,
    upc: input.upc ?? null,
    mpn: input.mpn ?? null,
    searchEvidence,
    structuredMetadata,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Parsing & Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse the AI response string into a validated AIProductResponse.
 * Returns null if the response cannot be parsed or fails validation.
 */
export function parseAIResponse(responseContent: string): AIProductResponse | null {
  // Try direct JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseContent);
  } catch {
    // AI might wrap in markdown code blocks
    const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch {
        // Try finding raw JSON object
        const rawMatch = responseContent.match(/\{[\s\S]*\}/);
        if (rawMatch) {
          try {
            parsed = JSON.parse(rawMatch[0]);
          } catch {
            return null;
          }
        } else {
          return null;
        }
      }
    } else {
      // Try finding raw JSON object
      const rawMatch = responseContent.match(/\{[\s\S]*\}/);
      if (rawMatch) {
        try {
          parsed = JSON.parse(rawMatch[0]);
        } catch {
          return null;
        }
      } else {
        return null;
      }
    }
  }

  return validateAIResponseStructure(parsed);
}

/**
 * Validate that a parsed object matches the expected AIProductResponse structure.
 * Normalizes fields and applies defaults where safe.
 */
function validateAIResponseStructure(parsed: unknown): AIProductResponse | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  // Validate status
  const validStatuses = ['identified', 'uncertain', 'conflict', 'not_found'];
  const status = typeof obj.status === 'string' && validStatuses.includes(obj.status)
    ? (obj.status as AIProductResponse['status'])
    : 'uncertain';

  // Validate product
  const product = validateProductData(obj.product);
  if (!product) return null;

  // Validate confidence
  const confidence = validateConfidenceScores(obj.confidence);

  // Validate arrays
  const sources = Array.isArray(obj.sources)
    ? obj.sources.filter((s): s is string => typeof s === 'string').slice(0, 10)
    : [];

  const verifiedFields = Array.isArray(obj.verifiedFields)
    ? obj.verifiedFields.filter((f): f is string => typeof f === 'string').slice(0, 20)
    : [];

  const conflicts = Array.isArray(obj.conflicts)
    ? obj.conflicts.filter(isValidConflict).slice(0, 10)
    : [];

  const reason = typeof obj.reason === 'string' ? obj.reason.substring(0, 500) : '';

  return {
    status,
    product,
    confidence,
    sources,
    verifiedFields,
    conflicts,
    reason,
  };
}

/**
 * Validate the product data portion of the AI response.
 */
function validateProductData(raw: unknown): AIProductResponse['product'] | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // At minimum, we need a name OR an identifiable status
  const name = nullableString(obj.name, 300);

  const pricing = validatePricing(obj.pricing);
  const sellers = validateSellers(obj.sellers);
  const images = validateImages(obj.images);
  const specifications = validateSpecifications(obj.specifications);
  const tags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === 'string').slice(0, 20)
    : [];

  return {
    name,
    brand: nullableString(obj.brand, 150),
    model: nullableString(obj.model, 200),
    category: nullableString(obj.category, 100),
    subCategory: nullableString(obj.subCategory, 100),
    sku: nullableString(obj.sku, 100),
    upc: nullableString(obj.upc, 50),
    asin: nullableString(obj.asin, 10),
    mpn: nullableString(obj.mpn, 100),
    productUrl: nullableUrl(obj.productUrl),
    storeUrl: nullableUrl(obj.storeUrl),
    description: nullableString(obj.description, 1000),
    notes: nullableString(obj.notes, 500),
    tags,
    pricing,
    sellers,
    images,
    specifications,
  };
}

function validatePricing(raw: unknown): AIProductResponse['product']['pricing'] {
  const defaults: AIProductResponse['product']['pricing'] = {
    currentPrice: null,
    currency: null,
    originalPrice: null,
    discountPercent: null,
    dealAmount: null,
    shipping: null,
    tax: null,
    coupon: null,
    promoCode: null,
  };

  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;

  return {
    currentPrice: nullablePositiveNumber(obj.currentPrice),
    currency: nullableString(obj.currency, 3),
    originalPrice: nullablePositiveNumber(obj.originalPrice),
    discountPercent: nullableNumber(obj.discountPercent, 0, 100),
    dealAmount: nullablePositiveNumber(obj.dealAmount),
    shipping: nullablePositiveNumber(obj.shipping),
    tax: nullablePositiveNumber(obj.tax),
    coupon: nullableString(obj.coupon, 200),
    promoCode: nullableString(obj.promoCode, 100),
  };
}

function validateSellers(raw: unknown): AIProductResponse['product']['sellers'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => s && typeof s === 'object')
    .slice(0, 10)
    .map((s) => ({
      name: typeof s.name === 'string' ? s.name.substring(0, 100) : 'Unknown',
      url: nullableUrl(s.url),
      price: nullablePositiveNumber(s.price),
      availability: nullableString(s.availability, 100),
      shipping: nullableString(s.shipping, 100),
    }));
}

function validateImages(raw: unknown): AIProductResponse['product']['images'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((img): img is Record<string, unknown> => img && typeof img === 'object')
    .slice(0, 10)
    .filter((img) => typeof img.url === 'string' && img.url.startsWith('http'))
    .map((img) => ({
      url: (img.url as string).substring(0, 2000),
      source: nullableString(img.source, 50),
      confidence: typeof img.confidence === 'number'
        ? Math.min(100, Math.max(0, Math.round(img.confidence)))
        : 50,
    }));
}

function validateSpecifications(raw: unknown): AIProductResponse['product']['specifications'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((spec): spec is Record<string, unknown> => spec && typeof spec === 'object')
    .slice(0, 30)
    .filter((spec) => typeof spec.key === 'string' && typeof spec.value === 'string')
    .map((spec) => ({
      key: (spec.key as string).substring(0, 100),
      value: (spec.value as string).substring(0, 500),
    }));
}

function validateConfidenceScores(raw: unknown): AIProductResponse['confidence'] {
  const defaults: AIProductResponse['confidence'] = {
    overall: 0,
    name: 0,
    brand: 0,
    model: 0,
    category: 0,
    sku: 0,
    upc: 0,
    asin: 0,
    mpn: 0,
    price: 0,
    image: 0,
  };

  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;

  return {
    overall: clampConfidence(obj.overall),
    name: clampConfidence(obj.name),
    brand: clampConfidence(obj.brand),
    model: clampConfidence(obj.model),
    category: clampConfidence(obj.category),
    sku: clampConfidence(obj.sku),
    upc: clampConfidence(obj.upc),
    asin: clampConfidence(obj.asin),
    mpn: clampConfidence(obj.mpn),
    price: clampConfidence(obj.price),
    image: clampConfidence(obj.image),
  };
}

function isValidConflict(raw: unknown): raw is AIProductResponse['conflicts'][number] {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  return typeof obj.field === 'string' &&
    typeof obj.sourceA === 'string' &&
    typeof obj.valueA === 'string' &&
    typeof obj.sourceB === 'string' &&
    typeof obj.valueB === 'string';
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function nullableString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return value.trim().substring(0, maxLength);
}

function nullableUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null;
  if (trimmed.length > 2000) return null;
  return trimmed;
}

function nullablePositiveNumber(value: unknown): number | null {
  if (typeof value !== 'number' || isNaN(value)) return null;
  if (value < 0) return null;
  return value;
}

function nullableNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || isNaN(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * Sanitize a URL for inclusion in the AI prompt.
 * Removes sensitive query params but keeps the structure.
 */
function sanitizeUrlForPrompt(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking/session params
    const sensitiveParams = ['session', 'token', 'auth', 'key', 'secret', 'password', 'sig'];
    for (const param of sensitiveParams) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString().substring(0, 500);
  } catch {
    return url.substring(0, 500);
  }
}

/**
 * Sanitize structured metadata for the AI prompt.
 * Removes any fields that might contain sensitive data.
 */
function sanitizeMetadataForPrompt(metadata: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  const allowedKeys = [
    'title', 'brand', 'description', 'price', 'currency',
    'image', 'category', 'sku', 'mpn', 'gtin', 'upc',
    'retailer', 'availability', 'rating', 'reviewCount',
  ];

  for (const key of allowedKeys) {
    if (key in metadata && metadata[key] != null) {
      const value = metadata[key];
      if (typeof value === 'string') {
        safe[key] = value.substring(0, 300);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        safe[key] = value;
      }
    }
  }

  return safe;
}
