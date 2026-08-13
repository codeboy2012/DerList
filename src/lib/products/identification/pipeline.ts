/**
 * Product Identification Pipeline — AI-First Design
 *
 * Orchestrates product identification with AI as the PRIMARY source.
 *
 * Flow:
 * 1. Check if AI provider is configured for the user
 *    → If NO: immediately return "no_ai_configured" status
 * 2. Gather supporting evidence (search providers, structured data)
 *    → Evidence is SUPPORTING, not authoritative
 * 3. Send ALL evidence to AI for identification
 *    → AI is the PRIMARY identification source
 * 4. Validate AI response (strict JSON schema)
 * 5. Verify product identity (ASIN match, conflict detection)
 * 6. Resolve product image (Keepa, search, verified URLs)
 * 7. Return result with field sources and confidence
 *
 * KEY PRINCIPLES:
 * - AI is PRIMARY. If no AI is configured, identification is unavailable.
 * - Search is SUPPORTING evidence. It does not independently identify products.
 * - Never fabricate data. Prefer null over guessing.
 * - Never trust a mismatched ASIN.
 * - Never use a URL as a product title.
 */

import { getProviderManager } from '@/lib/providers';
import { validateProduct } from '../validation';
import {
  AIIdentificationProvider,
  SearchIdentificationProvider,
  StructuredDataProvider,
} from './providers';
import type {
  IdentificationInput,
  IdentificationProvider,
  IdentificationResult,
  IdentifiedProduct,
  ImportStatus,
  ProviderAttempt,
  StageTiming,
} from './types';
import { importLog } from './logging';
import type {
  AIImportStatus,
  NoAIConfiguredResult,
} from './ai-identification-types';

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum confidence to auto-accept without review */
const HIGH_CONFIDENCE_THRESHOLD = 75;

/** Minimum confidence to accept (with review flag) */
const ACCEPT_THRESHOLD = 50;

/** Below this, the result is not useful */
const REJECT_THRESHOLD = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Extended Result Type (includes AI-specific status)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtendedIdentificationResult extends IdentificationResult {
  /** AI-specific import status with full lifecycle */
  aiImportStatus: AIImportStatus;
  /** No-AI-configured result details (when AI is unavailable) */
  noAIConfigured?: NoAIConfiguredResult;
  /** AI identification metadata */
  aiMetadata?: Record<string, unknown>;
  /** Field sources for all identified fields */
  fieldSources?: Record<string, unknown>;
  /** Identity verification details */
  identityVerification?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full product identification pipeline.
 *
 * AI-FIRST Strategy:
 * 1. Check AI availability (hard requirement)
 * 2. Gather search evidence (supporting data for AI)
 * 3. Run AI identification with ALL evidence
 * 4. Validate + verify the AI result
 * 5. Resolve image
 * 6. Return structured result
 *
 * If no AI is configured, returns immediately with no_ai_configured status.
 */
export async function identifyProduct(input: IdentificationInput): Promise<ExtendedIdentificationResult> {
  const startTime = Date.now();
  const attempts: ProviderAttempt[] = [];
  const timing: StageTiming = { totalMs: 0 };

  importLog('IMPORT_STARTED', {
    inputType: input.inputType,
    asin: input.asin,
    retailer: input.retailer,
    directExtractionFailed: input.directExtractionFailed,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 1: Check AI Availability
  // ──────────────────────────────────────────────────────────────────────────

  const providers = getProviderManager();
  let aiAvailable = false;

  try {
    const aiProvider = await providers.getAIProvider(input.userId);
    aiAvailable = aiProvider !== null;
  } catch {
    aiAvailable = false;
  }

  if (!aiAvailable) {
    // AI is NOT configured — identification is unavailable
    timing.totalMs = Date.now() - startTime;

    const noAIResult: NoAIConfiguredResult = {
      status: 'no_ai_configured',
      message: 'AI product identification is not configured. Please enter the product details manually.',
      verifiedContext: {
        url: input.url ?? null,
        asin: input.asin ?? null,
        retailer: input.retailer ?? null,
        sku: null,
        upc: null,
        mpn: null,
      },
    };

    importLog('AI_SKIPPED', { reason: 'No AI provider configured for user' });

    return {
      success: false,
      product: null,
      providersAttempted: [],
      statusMessage: "AI identification isn't configured. DerList needs a connected AI provider to automatically identify products from URLs. Please enter the product details manually below.",
      needsReview: true,
      durationMs: timing.totalMs,
      completeness: 0,
      importStatus: 'failed',
      timing,
      aiImportStatus: 'no_ai_configured',
      noAIConfigured: noAIResult,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 2: Gather Supporting Evidence (Search + Structured Data)
  // ──────────────────────────────────────────────────────────────────────────

  let searchResult: IdentifiedProduct | null = null;
  let structuredResult: IdentifiedProduct | null = null;

  // 2a. Try structured data extraction (fast, no API calls if page already fetched)
  if (!input.directExtractionFailed && input.url) {
    const structuredProvider = new StructuredDataProvider();
    if (structuredProvider.canHandle(input)) {
      const structuredStart = Date.now();
      try {
        structuredResult = await structuredProvider.identify(input);
        const duration = Date.now() - structuredStart;
        attempts.push({
          provider: structuredProvider.name,
          success: !!structuredResult,
          confidence: structuredResult?.confidence ?? 0,
          durationMs: duration,
        });
      } catch (error) {
        attempts.push({
          provider: structuredProvider.name,
          success: false,
          confidence: 0,
          durationMs: Date.now() - structuredStart,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  // 2b. Search provider — gather SUPPORTING evidence
  const searchProvider = new SearchIdentificationProvider();
  if (searchProvider.canHandle(input)) {
    const searchStart = Date.now();
    try {
      searchResult = await searchProvider.identify(input);
      const duration = Date.now() - searchStart;
      timing.searchMs = duration;
      attempts.push({
        provider: searchProvider.name,
        success: !!searchResult,
        confidence: searchResult?.confidence ?? 0,
        durationMs: duration,
      });

      if (searchResult) {
        importLog('SEARCH_RESULT_FOUND', {
          title: searchResult.title,
          confidence: searchResult.confidence,
          hasImage: !!searchResult.imageUrl,
          hasPrice: searchResult.price != null,
        });
      }
    } catch (error) {
      timing.searchMs = Date.now() - searchStart;
      attempts.push({
        provider: searchProvider.name,
        success: false,
        confidence: 0,
        durationMs: timing.searchMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 3: AI Identification (PRIMARY)
  // ──────────────────────────────────────────────────────────────────────────

  const aiProvider = new AIIdentificationProvider();
  let aiResult: IdentifiedProduct | null = null;

  if (aiProvider.canHandle(input)) {
    const aiStart = Date.now();
    try {
      aiResult = await aiProvider.identify(input);
      const duration = Date.now() - aiStart;
      timing.aiMs = duration;

      if (aiResult) {
        const validation = validateProduct({
          title: aiResult.title,
          price: aiResult.price,
          brand: aiResult.brand,
          image: aiResult.imageUrl,
          retailer: aiResult.retailer,
        }, aiResult.confidence);

        attempts.push({
          provider: aiProvider.name,
          success: validation.isAcceptable,
          confidence: validation.overallConfidence,
          durationMs: duration,
        });

        // Apply validation confidence adjustment
        if (validation.isAcceptable) {
          aiResult = {
            ...aiResult,
            confidence: validation.overallConfidence,
            needsReview: validation.overallConfidence < HIGH_CONFIDENCE_THRESHOLD,
          };
        } else {
          // AI produced something but validation rejected it
          importLog('VALIDATION_FAILED', {
            title: aiResult.title,
            issues: validation.issues,
          });
          aiResult = null;
        }
      } else {
        attempts.push({
          provider: aiProvider.name,
          success: false,
          confidence: 0,
          durationMs: duration,
          error: (input as any)._aiFailure?.error ?? 'AI returned no result',
        });
      }
    } catch (error) {
      timing.aiMs = Date.now() - aiStart;
      attempts.push({
        provider: aiProvider.name,
        success: false,
        confidence: 0,
        durationMs: timing.aiMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 4: Select Best Result
  // ──────────────────────────────────────────────────────────────────────────

  // AI result is preferred over search/structured data
  let bestResult: IdentifiedProduct | null = aiResult;
  let bestConfidence = aiResult?.confidence ?? 0;

  // If AI failed but search has a valid result, use it as a fallback
  // (still needs review since AI is the authority)
  if (!bestResult && searchResult) {
    const searchValidation = validateProduct({
      title: searchResult.title,
      price: searchResult.price,
      brand: searchResult.brand,
      image: searchResult.imageUrl,
      retailer: searchResult.retailer,
    }, searchResult.confidence);

    if (searchValidation.isAcceptable) {
      bestResult = {
        ...searchResult,
        confidence: Math.min(searchValidation.overallConfidence, 60), // Cap search-only at 60
        needsReview: true, // Always needs review without AI confirmation
      };
      bestConfidence = bestResult.confidence;
    }
  }

  // If neither AI nor search worked, try structured data
  if (!bestResult && structuredResult) {
    const structValidation = validateProduct({
      title: structuredResult.title,
      price: structuredResult.price,
      brand: structuredResult.brand,
      image: structuredResult.imageUrl,
      retailer: structuredResult.retailer,
    }, structuredResult.confidence);

    if (structValidation.isAcceptable) {
      bestResult = {
        ...structuredResult,
        confidence: Math.min(structValidation.overallConfidence, 55), // Cap structured-only at 55
        needsReview: true,
      };
      bestConfidence = bestResult.confidence;
    }
  }

  // ── Enrich AI result with search data if AI is missing fields ──
  if (aiResult && searchResult) {
    bestResult = enrichWithSupportingEvidence(aiResult, searchResult, structuredResult);
    bestConfidence = bestResult.confidence;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 5: Image Resolution
  // ──────────────────────────────────────────────────────────────────────────

  if (bestResult && !bestResult.imageUrl) {
    const imageStart = Date.now();
    try {
      const { resolveProductImage } = await import('./image-resolution');
      const imageResult = await resolveProductImage({
        asin: input.asin,
        title: bestResult.title,
        brand: bestResult.brand ?? undefined,
        retailer: bestResult.retailer ?? undefined,
        url: bestResult.url ?? undefined,
        userId: input.userId,
        searchImages: (input as any)._searchImages,
      });

      if (imageResult.imageUrl) {
        bestResult = {
          ...bestResult,
          imageUrl: imageResult.imageUrl,
          fieldSources: {
            ...bestResult.fieldSources,
            imageSource: imageResult.httpVerified
              ? `${imageResult.source} (http-verified)`
              : imageResult.source,
          },
        };
      }
    } catch {
      // Image resolution is best-effort, never blocks the pipeline
    }
    timing.imageMs = Date.now() - imageStart;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 6: Calculate Completeness & Determine Final Status
  // ──────────────────────────────────────────────────────────────────────────

  let completeness = 0;
  if (bestResult) {
    const { calculateCompleteness } = await import('./completeness');
    const report = calculateCompleteness(bestResult);
    completeness = report.score;
  }

  // ── Check for identity conflict ──
  const identityConflict = (input as any)._identityConflict;
  if (identityConflict && !identityConflict.verified) {
    timing.totalMs = Date.now() - startTime;
    importLog('PIPELINE_COMPLETE', {
      success: false,
      status: 'conflict',
      duration: timing.totalMs,
    });

    return {
      success: false,
      product: bestResult,
      providersAttempted: attempts,
      statusMessage: buildConflictMessage(input, identityConflict),
      needsReview: true,
      durationMs: timing.totalMs,
      completeness,
      importStatus: 'needs_review',
      timing,
      aiImportStatus: 'conflict',
      identityVerification: identityConflict,
    };
  }

  // ── Check for AI failure ──
  const aiFailure = (input as any)._aiFailure;
  if (!bestResult && aiFailure) {
    timing.totalMs = Date.now() - startTime;
    importLog('PIPELINE_COMPLETE', {
      success: false,
      status: 'ai_failed',
      error: aiFailure.error,
      duration: timing.totalMs,
    });

    return {
      success: false,
      product: null,
      providersAttempted: attempts,
      statusMessage: buildAIFailureMessage(aiFailure),
      needsReview: true,
      durationMs: timing.totalMs,
      completeness: 0,
      importStatus: 'failed',
      timing,
      aiImportStatus: 'failed',
    };
  }

  // ── Success: product identified ──
  if (bestResult && bestConfidence >= ACCEPT_THRESHOLD) {
    timing.totalMs = Date.now() - startTime;
    const isHighConfidence = bestConfidence >= HIGH_CONFIDENCE_THRESHOLD;
    const importStatus: ImportStatus = isHighConfidence ? 'ready' : 'needs_review';
    const aiImportStatus: AIImportStatus = isHighConfidence ? 'ready' : 'needs_review';

    importLog('PIPELINE_COMPLETE', {
      success: true,
      confidence: bestConfidence,
      completeness,
      duration: timing.totalMs,
      providersAttempted: attempts.length,
      source: bestResult.source,
    });

    return {
      success: true,
      product: bestResult,
      providersAttempted: attempts,
      statusMessage: isHighConfidence
        ? `Product identified — ${bestConfidence}% confidence`
        : 'Product identified — please review the details',
      needsReview: !isHighConfidence,
      durationMs: timing.totalMs,
      completeness,
      importStatus,
      timing,
      aiImportStatus,
      aiMetadata: (input as any)._aiMetadata ?? undefined,
      fieldSources: (input as any)._fieldSources ?? undefined,
      identityVerification: (input as any)._identityVerification ?? undefined,
    };
  }

  // ── Partial result below threshold ──
  if (bestResult && bestConfidence >= REJECT_THRESHOLD) {
    timing.totalMs = Date.now() - startTime;
    importLog('PRODUCT_NEEDS_REVIEW', { confidence: bestConfidence, duration: timing.totalMs });

    return {
      success: true,
      product: bestResult,
      providersAttempted: attempts,
      statusMessage: 'Product partially identified — please review and correct the details',
      needsReview: true,
      durationMs: timing.totalMs,
      completeness,
      importStatus: 'needs_review',
      timing,
      aiImportStatus: 'needs_review',
      aiMetadata: (input as any)._aiMetadata ?? undefined,
      fieldSources: (input as any)._fieldSources ?? undefined,
    };
  }

  // ── Complete failure ──
  timing.totalMs = Date.now() - startTime;
  importLog('PRODUCT_IDENTIFICATION_FAILED', {
    attempts: attempts.length,
    duration: timing.totalMs,
  });

  return {
    success: false,
    product: bestResult,
    providersAttempted: attempts,
    statusMessage: buildFailureMessage(input, attempts),
    needsReview: true,
    durationMs: timing.totalMs,
    completeness,
    importStatus: 'failed',
    timing,
    aiImportStatus: 'failed',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Enrichment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enrich AI result with supporting evidence from search and structured data.
 * AI fields always take precedence — search/structured fill GAPS only.
 */
function enrichWithSupportingEvidence(
  aiResult: IdentifiedProduct,
  searchResult: IdentifiedProduct | null,
  structuredResult: IdentifiedProduct | null,
): IdentifiedProduct {
  const enriched = { ...aiResult };

  // Fill gaps from search evidence
  if (searchResult) {
    if (!enriched.imageUrl && searchResult.imageUrl) {
      enriched.imageUrl = searchResult.imageUrl;
      enriched.fieldSources = {
        ...enriched.fieldSources,
        imageSource: 'search-provider',
      };
    }
    if (enriched.price == null && searchResult.price != null) {
      enriched.price = searchResult.price;
      enriched.currency = searchResult.currency ?? enriched.currency;
      enriched.fieldSources = {
        ...enriched.fieldSources,
        priceSource: 'search-provider',
      };
    }
    if (!enriched.brand && searchResult.brand) {
      enriched.brand = searchResult.brand;
      enriched.fieldSources = {
        ...enriched.fieldSources,
        brandSource: 'search-provider',
      };
    }
  }

  // Fill remaining gaps from structured data
  if (structuredResult) {
    if (!enriched.imageUrl && structuredResult.imageUrl) {
      enriched.imageUrl = structuredResult.imageUrl;
      enriched.fieldSources = {
        ...enriched.fieldSources,
        imageSource: 'structured-data',
      };
    }
    if (enriched.price == null && structuredResult.price != null) {
      enriched.price = structuredResult.price;
      enriched.currency = structuredResult.currency ?? enriched.currency;
      enriched.fieldSources = {
        ...enriched.fieldSources,
        priceSource: 'structured-data',
      };
    }
    if (!enriched.description && structuredResult.description) {
      enriched.description = structuredResult.description;
      enriched.fieldSources = {
        ...enriched.fieldSources,
        descriptionSource: 'structured-data',
      };
    }
  }

  return enriched;
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Builders
// ─────────────────────────────────────────────────────────────────────────────

function buildFailureMessage(input: IdentificationInput, attempts: ProviderAttempt[]): string {
  if (input.retailer === 'Amazon' && input.asin) {
    return `Could not reliably identify Amazon product (ASIN: ${input.asin}). ` +
      `Tried ${attempts.length} identification methods. ` +
      'Please enter the product details manually.';
  }

  if (input.url) {
    return "Couldn't reliably identify this product. " +
      'The connected AI could not verify enough information from this URL. ' +
      'Please enter the product details manually.';
  }

  return "Couldn't identify this product. Please enter the details manually.";
}

function buildAIFailureMessage(aiFailure: { error: string; isTimeout?: boolean }): string {
  if (aiFailure.isTimeout) {
    return "Couldn't reliably identify this product. " +
      'The AI provider timed out. Please try again or enter the product details manually.';
  }

  return "Couldn't reliably identify this product. " +
    'The connected AI couldn\'t verify enough information from this URL. ' +
    'Please enter the product details manually.';
}

function buildConflictMessage(
  input: IdentificationInput,
  verification: { conflicts: Array<{ message: string; severity: string }> },
): string {
  const critical = verification.conflicts.find((c: any) => c.severity === 'critical');

  if (critical) {
    return `Identity conflict detected: ${critical.message} ` +
      'Please review the product details carefully.';
  }

  if (input.asin) {
    return `Product identification produced conflicting results for ASIN ${input.asin}. ` +
      'Please verify the product details.';
  }

  return 'Product identification produced conflicting results. ' +
    'Please review the product details.';
}
