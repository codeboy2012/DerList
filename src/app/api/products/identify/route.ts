/**
 * POST /api/products/identify
 *
 * Universal product identification endpoint — AI-First Design.
 *
 * Pipeline:
 * 1. Run universal importer (detects input type, extracts initial data)
 * 2. Check AI provider availability
 *    → If NO AI: return no_ai_configured status with manual entry prompt
 * 3. For drafts that need identification:
 *    → Run the AI-first identification pipeline
 *    → AI is PRIMARY, search/structured data are SUPPORTING evidence
 * 4. Validate AI response + verify identity (ASIN match, conflict detection)
 * 5. Return results with confidence, field sources, and AI metadata
 * 6. Emit SSE events for live wishlist panel updates
 *
 * NEVER:
 * - Fabricates product information
 * - Uses a URL as a product title
 * - Trusts a mismatched ASIN
 * - Silently overwrites user wishlist data
 * - Claims success when identification failed
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { universalImport } from '@/lib/importers';
import { identifyProduct } from '@/lib/products/identification';
import type { IdentificationInput } from '@/lib/products/identification';
import type { ExtendedIdentificationResult } from '@/lib/products/identification/pipeline';
import type { AIImportStatus } from '@/lib/products/identification/ai-identification-types';
import { validateTitle } from '@/lib/products/validation';
import { extractAsinFromUrl } from '@/lib/importers/amazon';
import { extractDomain, getRetailerName } from '@/lib/products/normalize';
import { createServices } from '@/lib/services/create';
import type { ProductDraft } from '@/lib/services/product';
import {
  emitIdentificationEvent,
  generateOperationId,
  buildActivityTimeline,
  type IdentificationActivityItem,
} from '@/lib/events/wishlist-events';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface IdentifyResponse {
  success: boolean;
  drafts: ProductDraft[];
  isBatch: boolean;
  batchName?: string;
  batchMeta?: {
    description?: string;
    sourceUrl?: string;
    notes?: string;
  };
  /** Per-item identification status for UI display */
  itemStatuses?: ItemStatus[];
  /** Legacy compatibility */
  candidates: LegacyCandidate[];
  /** Error message if overall pipeline failed */
  error?: string;
  /** AI identification metadata */
  aiIdentification?: AIIdentificationMeta;
}

interface ItemStatus {
  index: number;
  status: 'identified' | 'needs-review' | 'failed' | 'no-ai-configured' | 'conflict';
  confidence: number;
  source: string;
  message: string;
  /** Providers that were attempted */
  providersAttempted?: string[];
  /** AI import status */
  aiImportStatus?: AIImportStatus;
  /** Field sources for identified fields */
  fieldSources?: Record<string, unknown>;
  /** Identity verification details */
  identityVerification?: Record<string, unknown>;
}

interface AIIdentificationMeta {
  /** AI provider used */
  provider?: string;
  /** Model used */
  model?: string;
  /** Overall confidence */
  confidence?: number;
  /** Import status */
  importStatus: AIImportStatus;
  /** Activity timeline for UI */
  activity?: IdentificationActivityItem[];
  /** Operation ID for SSE tracking */
  operationId: string;
  /** Duration in ms */
  durationMs?: number;
}

interface LegacyCandidate {
  title: string;
  brand?: string;
  retailer?: string;
  category?: string;
  url?: string;
  image?: string;
  sku?: string;
  description?: string;
  currentPrice?: number;
  originalPrice?: number;
  currency: string;
  dealInfo?: string;
  confidence: number;
  verified: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { input?: string; type?: string; data?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Support both new format (input) and legacy format (type + data)
  const input = body.input ?? (body.data as Record<string, string>)?.title ?? '';

  if (!input || typeof input !== 'string' || input.trim().length < 2) {
    return NextResponse.json({ error: 'Input is required (min 2 characters).' }, { status: 400 });
  }

  const operationId = generateOperationId();

  try {
    const trimmedInput = input.trim();

    // Emit identification started event
    emitIdentificationEvent(user.id, operationId, {
      step: isUrl(trimmedInput) ? 'url_recognized' : 'searching',
      status: 'in_progress',
    });

    // 1. Run the universal import pipeline
    const importResult = await universalImport(trimmedInput);

    // Extract ASIN early for event emission
    const earlyAsin = isUrl(trimmedInput) ? extractAsinFromUrl(trimmedInput) : null;
    if (earlyAsin) {
      emitIdentificationEvent(user.id, operationId, {
        step: 'asin_extracted',
        status: 'in_progress',
        product: { name: null, brand: null, asin: earlyAsin, price: null, image: null },
      });
    }

    // 2. Process each draft — either accept, run identification pipeline, or flag
    const { products } = createServices();
    const processedDrafts: ProductDraft[] = [];
    const itemStatuses: ItemStatus[] = [];

    for (let i = 0; i < importResult.drafts.length; i++) {
      const draft = importResult.drafts[i];
      const result = await processDraft(draft, trimmedInput, user.id, products, operationId);
      processedDrafts.push(result.draft);
      itemStatuses.push({ index: i, ...result.status });
    }

    // 3. Determine overall AI identification metadata
    const firstStatus = itemStatuses[0];
    const aiMeta: AIIdentificationMeta = {
      importStatus: firstStatus?.aiImportStatus ?? 'failed',
      confidence: firstStatus?.confidence,
      operationId,
      durationMs: undefined, // Set below
      activity: buildActivityTimeline(
        operationId,
        {
          url: isUrl(trimmedInput) ? trimmedInput : undefined,
          asin: earlyAsin ?? undefined,
          retailer: processedDrafts[0]?.retailer,
        },
        {
          success: firstStatus?.status === 'identified',
          confidence: firstStatus?.confidence,
          product: processedDrafts[0] ? {
            title: processedDrafts[0].title,
            brand: processedDrafts[0].brand,
            asin: processedDrafts[0].asin,
          } : undefined,
          aiImportStatus: firstStatus?.aiImportStatus,
          fieldSources: firstStatus?.fieldSources as Record<string, unknown> | undefined,
        },
      ),
    };

    // 4. Emit completion event
    const isSuccess = processedDrafts.length > 0 && firstStatus?.status !== 'failed' && firstStatus?.status !== 'no-ai-configured';
    emitIdentificationEvent(user.id, operationId, {
      step: isSuccess ? 'completed' : (firstStatus?.aiImportStatus === 'no_ai_configured' ? 'no_ai_configured' : 'failed'),
      status: isSuccess ? 'success' : (firstStatus?.aiImportStatus === 'no_ai_configured' ? 'no_ai_configured' : 'failed'),
      product: processedDrafts[0] ? {
        name: processedDrafts[0].title || null,
        brand: processedDrafts[0].brand || null,
        asin: processedDrafts[0].asin || null,
        price: processedDrafts[0].currentPrice || null,
        image: processedDrafts[0].image || null,
      } : undefined,
      confidence: firstStatus?.confidence,
      activity: aiMeta.activity,
    });

    // 5. Return results
    const response: IdentifyResponse = {
      success: processedDrafts.length > 0 && firstStatus?.status !== 'no-ai-configured',
      drafts: processedDrafts,
      isBatch: importResult.isBatch,
      batchName: importResult.batchName,
      batchMeta: importResult.batchMeta,
      itemStatuses,
      candidates: processedDrafts.map(draftToLegacyCandidate),
      aiIdentification: aiMeta,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Product identify error:', error);

    // Emit failure event
    emitIdentificationEvent(user.id, operationId, {
      step: 'failed',
      status: 'failed',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to identify product.',
        drafts: [],
        candidates: [],
        itemStatuses: [],
        aiIdentification: {
          importStatus: 'failed' as AIImportStatus,
          operationId,
        },
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft Processing
// ─────────────────────────────────────────────────────────────────────────────

interface ProcessResult {
  draft: ProductDraft;
  status: Omit<ItemStatus, 'index'>;
}

/**
 * Process a single draft:
 * - If it has a valid title and reasonable confidence → enrich and return
 * - If it needs identification (empty/generic title, low confidence) → run pipeline
 * - If no AI configured → return no_ai_configured status
 * - If all fails → return with "failed" status
 */
async function processDraft(
  draft: ProductDraft,
  rawInput: string,
  userId: string,
  products: { enrich: (draft: ProductDraft, userId: string) => Promise<ProductDraft> },
  operationId: string,
): Promise<ProcessResult> {
  // Check if this draft needs further identification
  const needsIdentification = shouldRunIdentificationPipeline(draft);

  if (!needsIdentification) {
    // Draft is already acceptable — enrich it
    try {
      const enriched = await products.enrich(draft, userId);
      return {
        draft: enriched,
        status: {
          status: 'identified',
          confidence: enriched.confidence,
          source: draft.source,
          message: 'Product identified',
          aiImportStatus: 'ready',
        },
      };
    } catch {
      return {
        draft,
        status: {
          status: 'identified',
          confidence: draft.confidence,
          source: draft.source,
          message: 'Product identified (enrichment skipped)',
          aiImportStatus: 'ready',
        },
      };
    }
  }

  // ── Emit AI identifying event ──
  emitIdentificationEvent(userId, operationId, {
    step: 'ai_identifying',
    status: 'in_progress',
  });

  // ── Run the AI-first identification pipeline ──
  const identInput = buildIdentificationInput(draft, rawInput, userId);
  const identResult = await identifyProduct(identInput) as ExtendedIdentificationResult;

  // ── Handle no-AI-configured ──
  if (identResult.aiImportStatus === 'no_ai_configured') {
    // Keep verified URL/ASIN/retailer info populated
    const noAIContext = identResult.noAIConfigured;
    return {
      draft: {
        title: '', // Blank — user must enter manually
        url: noAIContext?.verifiedContext.url ?? draft.url ?? (isUrl(rawInput) ? rawInput : undefined),
        retailer: noAIContext?.verifiedContext.retailer ?? draft.retailer,
        asin: noAIContext?.verifiedContext.asin ?? (draft as any).asin,
        source: 'manual',
        confidence: 0,
      },
      status: {
        status: 'no-ai-configured',
        confidence: 0,
        source: 'manual',
        message: "AI identification isn't configured. DerList needs a connected AI provider to automatically identify products from URLs. Please enter the product details manually below.",
        aiImportStatus: 'no_ai_configured',
      },
    };
  }

  // ── Handle identity conflict ──
  if (identResult.aiImportStatus === 'conflict') {
    return {
      draft: {
        title: identResult.product?.title ?? '',
        url: identResult.product?.url ?? draft.url ?? undefined,
        retailer: identResult.product?.retailer ?? draft.retailer,
        asin: identResult.product?.asin ?? (draft as any).asin,
        source: 'import',
        confidence: identResult.product?.confidence ?? 0,
      },
      status: {
        status: 'conflict',
        confidence: identResult.product?.confidence ?? 0,
        source: identResult.product?.source ?? 'manual',
        message: identResult.statusMessage,
        providersAttempted: identResult.providersAttempted.map((p) => p.provider),
        aiImportStatus: 'conflict',
        identityVerification: identResult.identityVerification as Record<string, unknown> | undefined,
      },
    };
  }

  // ── Handle success ──
  if (identResult.success && identResult.product) {
    // Convert identified product back to ProductDraft
    const identifiedDraft: ProductDraft = {
      title: identResult.product.title,
      description: identResult.product.description ?? undefined,
      url: identResult.product.url ?? draft.url ?? undefined,
      image: identResult.product.imageUrl ?? undefined,
      brand: identResult.product.brand ?? undefined,
      retailer: identResult.product.retailer ?? draft.retailer ?? undefined,
      currentPrice: identResult.product.price ?? undefined,
      currency: identResult.product.currency ?? 'USD',
      sku: identResult.product.sku ?? undefined,
      asin: identResult.product.asin ?? (draft as any).asin ?? undefined,
      mpn: identResult.product.mpn ?? undefined,
      gtin: identResult.product.gtin ?? undefined,
      upc: identResult.product.upc ?? undefined,
      category: identResult.product.category ?? undefined,
      source: 'import',
      confidence: identResult.product.confidence,
    };

    // Try to enrich the identified draft (non-blocking)
    let finalDraft = identifiedDraft;
    try {
      finalDraft = await products.enrich(identifiedDraft, userId);
    } catch {
      // Enrichment failure is not critical
    }

    const aiImportStatus: AIImportStatus = identResult.aiImportStatus ?? (identResult.needsReview ? 'needs_review' : 'ready');

    return {
      draft: finalDraft,
      status: {
        status: identResult.needsReview ? 'needs-review' : 'identified',
        confidence: finalDraft.confidence,
        source: identResult.product.source,
        message: identResult.statusMessage,
        providersAttempted: identResult.providersAttempted.map((p) => p.provider),
        aiImportStatus,
        fieldSources: identResult.fieldSources as Record<string, unknown> | undefined,
        identityVerification: identResult.identityVerification as Record<string, unknown> | undefined,
      },
    };
  }

  // ── AI failed — return what we have ──
  if (identResult.product) {
    return {
      draft: {
        title: identResult.product.title || '',
        url: identResult.product.url ?? draft.url ?? undefined,
        retailer: identResult.product.retailer ?? draft.retailer ?? undefined,
        asin: identResult.product.asin ?? (draft as any).asin ?? undefined,
        source: 'import',
        confidence: identResult.product.confidence,
      },
      status: {
        status: 'needs-review',
        confidence: identResult.product.confidence,
        source: identResult.product.source,
        message: identResult.statusMessage,
        providersAttempted: identResult.providersAttempted.map((p) => p.provider),
        aiImportStatus: 'needs_review',
      },
    };
  }

  // ── Complete failure — return manual draft ──
  // IMPORTANT: Never use a URL as the product title
  const fallbackTitle = isUrl(rawInput) ? '' : (draft.title || rawInput);

  // Validate fallback title is not garbage
  const titleCheck = fallbackTitle ? validateTitle(fallbackTitle) : { valid: false };
  const safeTitle = titleCheck.valid ? fallbackTitle : '';

  return {
    draft: {
      title: safeTitle,
      url: draft.url ?? (isUrl(rawInput) ? rawInput : undefined),
      retailer: draft.retailer,
      asin: (draft as any).asin,
      source: 'manual',
      confidence: 10,
    },
    status: {
      status: 'failed',
      confidence: 10,
      source: 'manual',
      message: identResult.statusMessage || "Couldn't reliably identify this product. The connected AI couldn't verify enough information from this URL. Please enter the product details manually.",
      providersAttempted: identResult.providersAttempted.map((p) => p.provider),
      aiImportStatus: 'failed',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine if a draft needs the identification pipeline.
 * Returns true if the draft has invalid/missing critical data.
 */
function shouldRunIdentificationPipeline(draft: ProductDraft): boolean {
  // Empty title → definitely needs identification
  if (!draft.title || draft.title.trim().length === 0) return true;

  // Invalid title (generic retailer name, etc.)
  const titleValidation = validateTitle(draft.title);
  if (!titleValidation.valid) return true;

  // Very low confidence from importer
  if (draft.confidence < 40) return true;

  // Check for _meta.needsIdentification flag (set by Amazon importer)
  if ((draft as any)._meta?.needsIdentification) return true;

  return false;
}

/**
 * Build an IdentificationInput from a draft and raw user input.
 */
function buildIdentificationInput(
  draft: ProductDraft,
  rawInput: string,
  userId: string,
): IdentificationInput {
  const meta = (draft as any)._meta;
  const url = draft.url ?? undefined;
  const asin = (draft as any).asin ?? (url ? extractAsinFromUrl(url) : null) ?? undefined;
  const domain = url ? extractDomain(url) : null;
  const retailer = draft.retailer ?? (domain ? getRetailerName(domain) : null) ?? undefined;

  // Determine input type
  let inputType: 'url' | 'product-name' | 'shopping-list' = 'product-name';
  if (url || rawInput.startsWith('http')) {
    inputType = 'url';
  }

  return {
    rawInput,
    inputType,
    url: url ?? (rawInput.startsWith('http') ? rawInput : undefined),
    asin: asin ?? undefined,
    retailer: retailer ?? undefined,
    country: meta?.amazonCountry ?? undefined,
    userId,
    directExtractionFailed: meta?.directExtractionFailed ?? false,
    failureReason: meta?.failureReason ?? undefined,
    partialData: {
      title: draft.title || undefined,
      brand: draft.brand || undefined,
      imageUrl: draft.image || undefined,
      category: draft.category || undefined,
    },
  };
}

/**
 * Convert a ProductDraft to the legacy candidate format for backward compatibility.
 */
function draftToLegacyCandidate(draft: ProductDraft): LegacyCandidate {
  return {
    title: draft.title,
    brand: draft.brand,
    retailer: draft.retailer,
    category: draft.category,
    url: draft.url,
    image: draft.image,
    sku: draft.sku,
    description: draft.description,
    currentPrice: draft.currentPrice,
    originalPrice: draft.originalPrice,
    currency: draft.currency ?? 'USD',
    dealInfo: draft.dealInfo,
    confidence: draft.confidence,
    verified: draft.confidence >= 80,
  };
}

/**
 * Check if a string looks like a URL.
 * Used to prevent URLs from being used as product titles.
 */
function isUrl(str: string): boolean {
  return /^https?:\/\//i.test(str.trim());
}
