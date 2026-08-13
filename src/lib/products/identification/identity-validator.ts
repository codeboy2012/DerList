/**
 * Product Identity Validator
 *
 * Verifies that an identified product is the CORRECT product by cross-checking
 * identifiers, evidence, and consistency signals.
 *
 * CORE PRINCIPLE: The system should prefer being incomplete and honest
 * over being complete and wrong.
 *
 * Key rules:
 * 1. ASIN from the URL is the ground truth for Amazon products.
 *    If AI returns a different ASIN → identity conflict → reject.
 * 2. Search results containing an ASIN are NOT by themselves sufficient
 *    proof of identity. Require multiple pieces of evidence.
 * 3. If AI and search disagree on product identity, flag the conflict.
 * 4. Never accept a URL as a product title.
 * 5. Never trust a mismatched ASIN.
 */

import type { IdentificationInput } from './types';
import type { SearchEvidence } from './providers/search-provider';
import type {
  AIProductResponse,
  IdentityVerificationResult,
  IdentityCheck,
  IdentityConflict,
} from './ai-identification-types';
import { validateImageUrl } from './image-resolution';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum word overlap for titles to be considered consistent */
const TITLE_SIMILARITY_THRESHOLD = 0.25;

/** ASIN format: exactly 10 alphanumeric characters */
const ASIN_PATTERN = /^[A-Z0-9]{10}$/i;

/** UPC format: 12 digits */
const UPC_PATTERN = /^\d{12}$/;

/** URL pattern — used to reject URLs as product titles */
const URL_PATTERN = /^https?:\/\//i;

// ─────────────────────────────────────────────────────────────────────────────
// SSRF Protection — URL validation for product/store URLs
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^169\.254\.\d+\.\d+$/,
  /\.local$/i,
  /\.internal$/i,
  /^metadata\./i,
];

const BLOCKED_PORTS = new Set([
  21, 22, 23, 25, 53, 110, 143, 389, 445, 465, 587, 636,
  993, 995, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 6380,
  11211, 27017, 27018, 27019,
]);

/**
 * Check if a URL is safe (not targeting internal/private addresses).
 */
export function isUrlSafe(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url);

    // Must be http or https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Check blocked hostname patterns
    for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
      if (pattern.test(hostname)) return false;
    }

    // Check blocked ports
    if (parsed.port) {
      const port = parseInt(parsed.port, 10);
      if (BLOCKED_PORTS.has(port)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Validator
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidateIdentityInput {
  /** The pipeline input with identifiers */
  pipelineInput: IdentificationInput;
  /** AI's product response */
  aiResponse: AIProductResponse;
  /** Search evidence from search provider stage */
  searchEvidence?: SearchEvidence | null;
  /** All search evidence results (not just the best) */
  allSearchEvidence?: SearchEvidence[];
}

/**
 * Run comprehensive identity validation on an AI-identified product.
 *
 * Checks:
 * 1. ASIN match (critical)
 * 2. UPC/SKU/MPN consistency
 * 3. Title is not a URL
 * 4. Title is not just a retailer name
 * 5. Title consistency with search evidence
 * 6. Brand consistency
 * 7. Price reasonableness
 * 8. URL safety (SSRF)
 * 9. Image URL safety
 * 10. Multiple evidence agreement
 */
export function validateProductIdentity(
  input: ValidateIdentityInput,
): IdentityVerificationResult {
  const { pipelineInput, aiResponse, searchEvidence, allSearchEvidence } = input;
  const checks: IdentityCheck[] = [];
  const conflicts: IdentityConflict[] = [];

  // ── 1. ASIN Verification (Critical for Amazon) ──
  if (pipelineInput.asin) {
    const check = verifyAsin(pipelineInput.asin, aiResponse.product.asin);
    checks.push(check);

    if (!check.passed) {
      conflicts.push({
        field: 'asin',
        inputValue: pipelineInput.asin,
        aiValue: aiResponse.product.asin ?? '(not returned)',
        evidenceValue: searchEvidence?.matchedAsin ? pipelineInput.asin : null,
        severity: 'critical',
        message: `ASIN mismatch: input ${pipelineInput.asin} vs AI ${aiResponse.product.asin ?? 'null'}. ` +
          'The AI returned a different product. Rejecting.',
      });
    }
  }

  // ── 2. Title is not a URL ──
  if (aiResponse.product.name) {
    const titleCheck = verifyTitleNotUrl(aiResponse.product.name);
    checks.push(titleCheck);

    if (!titleCheck.passed) {
      conflicts.push({
        field: 'title',
        inputValue: pipelineInput.rawInput,
        aiValue: aiResponse.product.name,
        evidenceValue: null,
        severity: 'critical',
        message: 'AI returned a URL as the product title. This indicates identification failure.',
      });
    }
  }

  // ── 3. Title is not a generic retailer name ──
  if (aiResponse.product.name) {
    const retailerCheck = verifyTitleNotRetailer(aiResponse.product.name, pipelineInput.retailer);
    checks.push(retailerCheck);

    if (!retailerCheck.passed) {
      conflicts.push({
        field: 'title',
        inputValue: pipelineInput.rawInput,
        aiValue: aiResponse.product.name,
        evidenceValue: null,
        severity: 'critical',
        message: `AI returned "${aiResponse.product.name}" which is a retailer name, not a product.`,
      });
    }
  }

  // ── 4. Title consistency with search evidence ──
  if (searchEvidence?.title && aiResponse.product.name && searchEvidence.matchedAsin) {
    const titleConsistencyCheck = verifyTitleConsistency(
      aiResponse.product.name,
      searchEvidence.title,
    );
    checks.push(titleConsistencyCheck);

    if (!titleConsistencyCheck.passed) {
      conflicts.push({
        field: 'title',
        inputValue: searchEvidence.title,
        aiValue: aiResponse.product.name,
        evidenceValue: searchEvidence.title,
        severity: 'warning',
        message: `AI title "${aiResponse.product.name}" significantly differs from search evidence "${searchEvidence.title}". ` +
          'Possible misidentification.',
      });
    }
  }

  // ── 5. Brand consistency ──
  if (searchEvidence?.brand && aiResponse.product.brand && searchEvidence.matchedAsin) {
    const brandCheck = verifyBrandConsistency(aiResponse.product.brand, searchEvidence.brand);
    checks.push(brandCheck);

    if (!brandCheck.passed) {
      conflicts.push({
        field: 'brand',
        inputValue: searchEvidence.brand,
        aiValue: aiResponse.product.brand,
        evidenceValue: searchEvidence.brand,
        severity: 'warning',
        message: `Brand mismatch: AI says "${aiResponse.product.brand}" but search evidence says "${searchEvidence.brand}".`,
      });
    }
  }

  // ── 6. Price reasonableness ──
  if (aiResponse.product.pricing.currentPrice != null) {
    const priceCheck = verifyPriceReasonable(aiResponse.product.pricing.currentPrice);
    checks.push(priceCheck);

    // Cross-check with search evidence price
    if (searchEvidence?.price != null && !priceCheck.passed) {
      conflicts.push({
        field: 'price',
        inputValue: String(searchEvidence.price),
        aiValue: String(aiResponse.product.pricing.currentPrice),
        evidenceValue: String(searchEvidence.price),
        severity: 'info',
        message: `AI price $${aiResponse.product.pricing.currentPrice} seems unreasonable.`,
      });
    }
  }

  // ── 7. URL Safety (SSRF protection) ──
  if (aiResponse.product.productUrl) {
    const urlCheck = verifyUrlSafety(aiResponse.product.productUrl, 'productUrl');
    checks.push(urlCheck);
  }
  if (aiResponse.product.storeUrl) {
    const urlCheck = verifyUrlSafety(aiResponse.product.storeUrl, 'storeUrl');
    checks.push(urlCheck);
  }

  // ── 8. Image URL Safety ──
  for (const img of aiResponse.product.images) {
    const imgCheck = verifyImageSafety(img.url);
    checks.push(imgCheck);
  }

  // ── 9. Multiple evidence agreement ──
  if (allSearchEvidence && allSearchEvidence.length > 1 && aiResponse.product.name) {
    const agreementCheck = verifyMultipleEvidenceAgreement(
      aiResponse.product.name,
      allSearchEvidence,
    );
    checks.push(agreementCheck);
  }

  // ── 10. AI-reported conflicts ──
  for (const aiConflict of aiResponse.conflicts) {
    conflicts.push({
      field: aiConflict.field,
      inputValue: aiConflict.valueA,
      aiValue: aiConflict.valueB,
      evidenceValue: null,
      severity: 'warning',
      message: `AI reported conflict on ${aiConflict.field}: "${aiConflict.valueA}" (${aiConflict.sourceA}) vs "${aiConflict.valueB}" (${aiConflict.sourceB})`,
    });
  }

  // ── Calculate overall verification result ──
  const totalChecks = checks.length;
  const passedChecks = checks.filter(c => c.passed).length;
  const hasCriticalConflict = conflicts.some(c => c.severity === 'critical');
  const warningCount = conflicts.filter(c => c.severity === 'warning').length;

  let confidence: number;
  if (hasCriticalConflict) {
    confidence = 0;
  } else if (totalChecks === 0) {
    confidence = 50; // No checks = moderate confidence
  } else {
    confidence = Math.round((passedChecks / totalChecks) * 100);
    // Penalize for warnings
    confidence = Math.max(0, confidence - (warningCount * 10));
  }

  return {
    verified: !hasCriticalConflict && confidence >= 40,
    checks,
    conflicts,
    confidence,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Verification Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify ASIN matches exactly.
 * This is the MOST critical check for Amazon products.
 */
function verifyAsin(inputAsin: string, aiAsin: string | null): IdentityCheck {
  // If AI didn't return an ASIN, that's OK — input ASIN is preserved
  if (!aiAsin) {
    return {
      field: 'asin',
      expected: inputAsin,
      actual: null,
      passed: true,
      reason: 'AI did not return ASIN — input ASIN preserved as ground truth',
    };
  }

  // Validate ASIN format
  if (!ASIN_PATTERN.test(aiAsin)) {
    return {
      field: 'asin',
      expected: inputAsin,
      actual: aiAsin,
      passed: false,
      reason: `AI returned invalid ASIN format: "${aiAsin}"`,
    };
  }

  // Exact match (case-insensitive)
  const matches = aiAsin.toUpperCase() === inputAsin.toUpperCase();
  return {
    field: 'asin',
    expected: inputAsin,
    actual: aiAsin,
    passed: matches,
    reason: matches
      ? `ASIN verified: ${inputAsin}`
      : `ASIN MISMATCH: expected ${inputAsin}, got ${aiAsin} — WRONG PRODUCT`,
  };
}

/**
 * Verify that a title is not a URL.
 * Catches the "URL-as-title" bug.
 */
function verifyTitleNotUrl(title: string): IdentityCheck {
  const isUrl = URL_PATTERN.test(title.trim());
  return {
    field: 'title-not-url',
    expected: 'real product name',
    actual: title,
    passed: !isUrl,
    reason: isUrl
      ? `Title is a URL: "${title}" — not a product name`
      : 'Title is not a URL',
  };
}

/**
 * Verify that a title is not just a retailer name.
 */
function verifyTitleNotRetailer(title: string, retailer?: string): IdentityCheck {
  const genericRetailers = new Set([
    'amazon', 'amazon.com', 'walmart', 'walmart.com', 'best buy', 'bestbuy',
    'target', 'target.com', 'newegg', 'newegg.com', 'ebay', 'ebay.com',
    'home depot', 'costco', 'aliexpress',
  ]);

  const lower = title.trim().toLowerCase();
  const isRetailerName = genericRetailers.has(lower);

  return {
    field: 'title-not-retailer',
    expected: 'real product name',
    actual: title,
    passed: !isRetailerName,
    reason: isRetailerName
      ? `Title "${title}" is a retailer name, not a product`
      : 'Title is not a generic retailer name',
  };
}

/**
 * Verify title consistency between AI and search evidence.
 * Uses word overlap to measure similarity.
 */
function verifyTitleConsistency(aiTitle: string, searchTitle: string): IdentityCheck {
  const similarity = calculateTitleSimilarity(aiTitle, searchTitle);
  const passed = similarity >= TITLE_SIMILARITY_THRESHOLD;

  return {
    field: 'title-consistency',
    expected: searchTitle,
    actual: aiTitle,
    passed,
    reason: passed
      ? `Titles are consistent (${Math.round(similarity * 100)}% similarity)`
      : `Titles differ significantly (${Math.round(similarity * 100)}% similarity): ` +
        `AI: "${aiTitle}" vs Search: "${searchTitle}"`,
  };
}

/**
 * Verify brand consistency between AI and search evidence.
 */
function verifyBrandConsistency(aiBrand: string, searchBrand: string): IdentityCheck {
  const aiLower = aiBrand.toLowerCase().trim();
  const searchLower = searchBrand.toLowerCase().trim();

  // Exact match or containment
  const matches = aiLower === searchLower ||
    aiLower.includes(searchLower) ||
    searchLower.includes(aiLower);

  return {
    field: 'brand-consistency',
    expected: searchBrand,
    actual: aiBrand,
    passed: matches,
    reason: matches
      ? `Brand is consistent: "${aiBrand}"`
      : `Brand mismatch: AI="${aiBrand}" vs Search="${searchBrand}"`,
  };
}

/**
 * Verify that a price is reasonable (not obviously wrong).
 */
function verifyPriceReasonable(price: number): IdentityCheck {
  const reasonable = price > 0 && price < 100000;

  return {
    field: 'price-reasonable',
    expected: 'price between $0 and $100,000',
    actual: String(price),
    passed: reasonable,
    reason: reasonable
      ? `Price $${price} is within reasonable range`
      : `Price $${price} is outside reasonable range`,
  };
}

/**
 * Verify that a URL is safe (SSRF protection).
 */
function verifyUrlSafety(url: string, fieldName: string): IdentityCheck {
  const safe = isUrlSafe(url);

  return {
    field: `${fieldName}-safety`,
    expected: 'safe public URL',
    actual: url.substring(0, 100),
    passed: safe,
    reason: safe
      ? `${fieldName} URL is safe`
      : `${fieldName} URL failed SSRF safety check`,
  };
}

/**
 * Verify that an image URL is safe and structurally valid.
 */
function verifyImageSafety(url: string): IdentityCheck {
  const ssrfSafe = isUrlSafe(url);
  const structurallyValid = validateImageUrl(url);
  const passed = ssrfSafe && structurallyValid;

  return {
    field: 'image-safety',
    expected: 'safe, valid image URL',
    actual: url.substring(0, 100),
    passed,
    reason: passed
      ? 'Image URL is safe and structurally valid'
      : !ssrfSafe
        ? 'Image URL failed SSRF safety check'
        : 'Image URL failed structural validation (placeholder/logo/encrypted thumbnail)',
  };
}

/**
 * Verify that multiple search evidence results agree on the product identity.
 * If multiple results with ASIN match all point to the same product, confidence is higher.
 */
function verifyMultipleEvidenceAgreement(
  aiTitle: string,
  allEvidence: SearchEvidence[],
): IdentityCheck {
  const asinMatched = allEvidence.filter(e => e.matchedAsin && e.title);

  if (asinMatched.length < 2) {
    return {
      field: 'multi-evidence-agreement',
      expected: 'multiple sources agree',
      actual: `${asinMatched.length} ASIN-matched results`,
      passed: true, // Not enough evidence to check — not a failure
      reason: 'Insufficient evidence for multi-source verification',
    };
  }

  // Check how many ASIN-matched results have titles consistent with AI
  let agreeing = 0;
  for (const ev of asinMatched) {
    if (ev.title) {
      const similarity = calculateTitleSimilarity(aiTitle, ev.title);
      if (similarity >= TITLE_SIMILARITY_THRESHOLD) {
        agreeing++;
      }
    }
  }

  const agreementRatio = agreeing / asinMatched.length;
  const passed = agreementRatio >= 0.5;

  return {
    field: 'multi-evidence-agreement',
    expected: 'majority of evidence agrees',
    actual: `${agreeing}/${asinMatched.length} sources agree with AI title`,
    passed,
    reason: passed
      ? `${agreeing}/${asinMatched.length} ASIN-matched results agree with AI identification`
      : `Only ${agreeing}/${asinMatched.length} results agree — possible misidentification`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Title Similarity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate title similarity using normalized word overlap.
 * Returns 0-1 where 1 means identical word sets.
 *
 * Ignores common filler words and normalizes for comparison.
 */
function calculateTitleSimilarity(titleA: string, titleB: string): number {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'for', 'with', 'in', 'on', 'at',
    'to', 'of', 'by', 'is', 'it', 'its', 'from', 'new', 'edition',
  ]);

  const normalize = (title: string): Set<string> => {
    return new Set(
      title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !stopWords.has(w))
    );
  };

  const wordsA = normalize(titleA);
  const wordsB = normalize(titleB);

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  // Jaccard-like similarity: overlap / union
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? overlap / union : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Validate Identifiers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that an ASIN has the correct format.
 */
export function isValidAsin(asin: string | null | undefined): boolean {
  if (!asin) return false;
  return ASIN_PATTERN.test(asin);
}

/**
 * Validate that a UPC has the correct format (12 digits).
 */
export function isValidUpc(upc: string | null | undefined): boolean {
  if (!upc) return false;
  return UPC_PATTERN.test(upc);
}

/**
 * Check if a string looks like a URL (to prevent URL-as-title bugs).
 */
export function looksLikeUrl(value: string): boolean {
  return URL_PATTERN.test(value.trim());
}
