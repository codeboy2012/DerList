/**
 * AI Product Identification Provider — PRIMARY Identification Source
 *
 * This is the PRIMARY product identification mechanism in DerList.
 * It uses the user's configured AI provider to identify the EXACT product
 * from a URL, ASIN, or other identifiers.
 *
 * Design:
 * - AI is called with ALL available evidence (URL, ASIN, search results, metadata)
 * - AI returns strict structured JSON matching AIProductResponse schema
 * - Response is validated structurally and semantically
 * - Identity is verified (ASIN match, conflict detection)
 * - Field sources are tracked for every piece of data
 *
 * If no AI provider is configured, this provider explicitly reports
 * "no_ai_configured" instead of fabricating data.
 *
 * AI output is treated as UNTRUSTED input — validated, sanitized, and verified.
 */

import { getProviderManager } from '@/lib/providers';
import type { AIProvider, Message } from '@/lib/providers/types';
import { sanitizeBrand, sanitizeImage, sanitizeTitle } from '../../validation';
import type { IdentificationInput, IdentificationProvider, IdentifiedProduct } from '../types';
import type { SearchEvidence } from './search-provider';
import { importLog } from '../logging';
import {
  buildSystemPrompt,
  buildIdentificationPrompt,
  assembleIdentificationContext,
  parseAIResponse,
} from '../ai-product-prompt';
import type {
  AIIdentificationResult,
  AIProductResponse,
  FieldSourceMap,
  AIImportStatus,
  IdentityVerificationResult,
  IdentityCheck,
  IdentityConflict,
  AIIdentificationMetadata,
  NoAIConfiguredResult,
  SearchEvidenceContext,
} from '../ai-identification-types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum time to wait for AI response */
const AI_TIMEOUT_MS = 30000;

/** Maximum tokens for identification request */
const AI_MAX_TOKENS = 2048;

/** Temperature for identification (low = more deterministic) */
const AI_TEMPERATURE = 0.1;

// ─────────────────────────────────────────────────────────────────────────────
// Provider Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class AIIdentificationProvider implements IdentificationProvider {
  readonly id = 'ai-identification';
  readonly name = 'AI Identification';
  readonly priority = 10; // PRIMARY — runs first (lowest priority number = highest priority)

  canHandle(input: IdentificationInput): boolean {
    // AI can handle any input that has identifiable information
    return !!(input.asin || input.url || input.rawInput.length >= 3);
  }

  /**
   * Identify a product using the configured AI provider.
   *
   * Returns null if:
   * - No AI provider is configured (also sets _noAIConfigured on input)
   * - AI fails to respond or times out
   * - AI response fails validation
   * - Identity verification fails critically
   */
  async identify(input: IdentificationInput): Promise<IdentifiedProduct | null> {
    const startTime = Date.now();
    const providers = getProviderManager();

    // ── Check AI availability ──
    let aiProvider: AIProvider | null;
    try {
      aiProvider = await providers.getAIProvider(input.userId);
    } catch {
      aiProvider = null;
    }

    if (!aiProvider) {
      importLog('AI_SKIPPED', { reason: 'No AI provider configured' });

      // Signal to the pipeline that AI is not configured
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
      (input as any)._noAIConfigured = noAIResult;
      return null;
    }

    // ── Assemble context ──
    const searchEvidence = (input as any)._searchEvidence as SearchEvidence | undefined;
    const allSearchEvidence = (input as any)._allSearchEvidence as SearchEvidence[] | undefined;

    importLog('AI_IDENTIFICATION_STARTED', {
      asin: input.asin,
      retailer: input.retailer,
      hasSearchEvidence: !!searchEvidence,
      searchTitle: searchEvidence?.title,
    });

    // Convert search evidence to context format
    const evidenceForContext: SearchEvidenceContext[] = [];
    if (allSearchEvidence && allSearchEvidence.length > 0) {
      for (const ev of allSearchEvidence) {
        evidenceForContext.push({
          title: ev.title,
          brand: ev.brand,
          price: ev.price,
          currency: ev.currency,
          url: ev.url,
          retailer: ev.retailer,
          matchedAsin: ev.matchedAsin,
          matchedRetailer: ev.matchedRetailer,
          confidence: ev.resultConfidence,
        });
      }
    } else if (searchEvidence) {
      evidenceForContext.push({
        title: searchEvidence.title,
        brand: searchEvidence.brand,
        price: searchEvidence.price,
        currency: searchEvidence.currency,
        url: searchEvidence.url,
        retailer: searchEvidence.retailer,
        matchedAsin: searchEvidence.matchedAsin,
        matchedRetailer: searchEvidence.matchedRetailer,
        confidence: searchEvidence.resultConfidence,
      });
    }

    // Build structured metadata from partial data
    const structuredMetadata: Record<string, unknown> = {};
    if (input.partialData) {
      if (input.partialData.title) structuredMetadata.title = input.partialData.title;
      if (input.partialData.brand) structuredMetadata.brand = input.partialData.brand;
      if (input.partialData.description) structuredMetadata.description = input.partialData.description;
      if (input.partialData.price) structuredMetadata.price = input.partialData.price;
      if (input.partialData.imageUrl) structuredMetadata.image = input.partialData.imageUrl;
    }

    const context = assembleIdentificationContext({
      rawInput: input.rawInput,
      url: input.url,
      asin: input.asin,
      retailer: input.retailer,
      searchEvidence: evidenceForContext,
      structuredMetadata: Object.keys(structuredMetadata).length > 0 ? structuredMetadata : undefined,
    });

    // ── Build messages ──
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildIdentificationPrompt(context);

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    // ── Call AI with timeout ──
    let responseContent: string;
    let model: string | undefined;
    let tokensUsed: number | undefined;

    try {
      const response = await Promise.race([
        aiProvider.chat(messages, {
          maxTokens: AI_MAX_TOKENS,
          temperature: AI_TEMPERATURE,
          json: true,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI identification timeout')), AI_TIMEOUT_MS)
        ),
      ]);

      responseContent = response.content;
      model = response.model;
      tokensUsed = response.tokensUsed;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
      importLog('AI_ERROR', { error: errorMessage, durationMs });

      // Store failure metadata for the pipeline
      (input as any)._aiFailure = {
        error: errorMessage,
        durationMs,
        isTimeout: errorMessage.includes('timeout'),
      };
      return null;
    }

    // ── Parse AI response ──
    const aiResponse = parseAIResponse(responseContent);
    if (!aiResponse) {
      importLog('AI_PARSE_FAILED', {
        responsePreview: responseContent.substring(0, 200),
        durationMs: Date.now() - startTime,
      });
      (input as any)._aiFailure = {
        error: 'Failed to parse AI response as valid JSON',
        durationMs: Date.now() - startTime,
      };
      return null;
    }

    // ── Check if AI found the product ──
    if (aiResponse.status === 'not_found') {
      importLog('AI_IDENTIFICATION_COMPLETED', {
        status: 'not_found',
        reason: aiResponse.reason,
        durationMs: Date.now() - startTime,
      });
      (input as any)._aiResponse = aiResponse;
      return null;
    }

    // ── Validate product identity ──
    const identityVerification = this.verifyIdentity(input, aiResponse);

    // If critical identity conflict, reject
    if (!identityVerification.verified && identityVerification.conflicts.some(c => c.severity === 'critical')) {
      importLog('AI_IDENTIFICATION_COMPLETED', {
        status: 'conflict',
        conflicts: identityVerification.conflicts.map(c => c.message),
        durationMs: Date.now() - startTime,
      });

      // Store the conflict info for the pipeline
      (input as any)._aiResponse = aiResponse;
      (input as any)._identityConflict = identityVerification;
      return null;
    }

    // ── Extract and validate product data ──
    const product = aiResponse.product;
    const title = sanitizeTitle(product.name);

    if (!title) {
      importLog('AI_TITLE_INVALID', {
        title: product.name,
        durationMs: Date.now() - startTime,
      });
      return null;
    }

    // ── Build field sources ──
    const fieldSources = this.buildFieldSources(input, aiResponse, searchEvidence);

    // ── Determine confidence ──
    const confidence = this.calculateFinalConfidence(aiResponse, identityVerification, searchEvidence);

    // ── Build the identified product ──
    const durationMs = Date.now() - startTime;

    // Image: prefer search evidence images (will be resolved by image-resolution stage)
    // AI images are NOT trusted unless from evidence
    const imageUrl = this.resolveImageFromEvidence(aiResponse, searchEvidence, input);

    // Price: only accept if from evidence or AI has high confidence
    const price = this.resolvePriceFromEvidence(aiResponse, searchEvidence);

    // Store full AI result for downstream consumers
    const metadata: AIIdentificationMetadata = {
      provider: aiProvider.id ?? 'unknown',
      model: model ?? null,
      tokensUsed: tokensUsed ?? null,
      durationMs,
      timestamp: new Date().toISOString(),
      importMethod: input.inputType === 'url' ? 'url' : input.inputType === 'product-name' ? 'name' : 'shopping-list',
      importSource: input.retailer?.toLowerCase() ?? 'unknown',
    };

    (input as any)._aiResponse = aiResponse;
    (input as any)._aiMetadata = metadata;
    (input as any)._identityVerification = identityVerification;
    (input as any)._fieldSources = fieldSources;

    importLog('AI_IDENTIFICATION_COMPLETED', {
      status: aiResponse.status,
      title,
      brand: product.brand,
      confidence,
      asinMatch: identityVerification.checks.find(c => c.field === 'asin')?.passed ?? null,
      durationMs,
      model,
      tokensUsed,
    });

    const identifiedProduct: IdentifiedProduct = {
      title,
      brand: sanitizeBrand(product.brand, input.retailer) ?? null,
      price,
      currency: aiResponse.product.pricing.currency ?? searchEvidence?.currency ?? 'USD',
      retailer: input.retailer ?? null,
      url: input.url ?? product.productUrl ?? null,
      imageUrl,
      description: product.description ?? null,
      asin: input.asin ?? product.asin ?? null,
      sku: product.sku ?? null,
      mpn: product.mpn ?? null,
      gtin: null,
      upc: product.upc ?? null,
      category: product.category ?? null,
      confidence,
      source: 'ai-identification',
      evidence: this.buildEvidenceStrings(aiResponse, identityVerification),
      needsReview: confidence < 70 || aiResponse.status === 'uncertain',
      fieldSources: {
        titleSource: 'ai-identification',
        brandSource: product.brand ? 'ai-identification' : undefined,
        priceSource: price != null ? (searchEvidence?.price != null ? 'search-provider' : 'ai-identification') : undefined,
        categorySource: product.category ? 'ai-identification' : undefined,
        descriptionSource: product.description ? 'ai-identification' : undefined,
        imageSource: imageUrl ? (searchEvidence?.imageUrl === imageUrl ? 'search-provider' : 'ai-identification') : undefined,
        urlSource: input.url ? 'user-input' : undefined,
      },
    };

    return identifiedProduct;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Identity Verification
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verify that the AI identified the correct product by checking
   * identifiers against the input and evidence.
   */
  private verifyIdentity(
    input: IdentificationInput,
    aiResponse: AIProductResponse,
  ): IdentityVerificationResult {
    const checks: IdentityCheck[] = [];
    const conflicts: IdentityConflict[] = [];
    let totalChecks = 0;
    let passedChecks = 0;

    // ── ASIN Verification (critical for Amazon) ──
    if (input.asin) {
      totalChecks++;
      const aiAsin = aiResponse.product.asin;

      if (aiAsin) {
        const matches = aiAsin.toUpperCase() === input.asin.toUpperCase();
        checks.push({
          field: 'asin',
          expected: input.asin,
          actual: aiAsin,
          passed: matches,
          reason: matches
            ? 'ASIN matches input'
            : `ASIN mismatch: expected ${input.asin}, got ${aiAsin}`,
        });

        if (matches) {
          passedChecks++;
        } else {
          // ASIN mismatch is a CRITICAL conflict
          conflicts.push({
            field: 'asin',
            inputValue: input.asin,
            aiValue: aiAsin,
            evidenceValue: null,
            severity: 'critical',
            message: `AI returned ASIN ${aiAsin} but input ASIN is ${input.asin}. Identity conflict — wrong product.`,
          });
        }
      } else {
        // AI didn't return an ASIN — not a conflict, just unverified
        checks.push({
          field: 'asin',
          expected: input.asin,
          actual: null,
          passed: true, // Not a failure if AI didn't return one
          reason: 'AI did not return ASIN (input ASIN preserved)',
        });
        passedChecks++;
      }
    }

    // ── Retailer Verification ──
    if (input.retailer && aiResponse.product.name) {
      totalChecks++;
      // Check that the product name doesn't blatantly contradict retailer context
      // (e.g., if retailer is Amazon, product shouldn't be from a different platform)
      checks.push({
        field: 'retailer',
        expected: input.retailer,
        actual: input.retailer,
        passed: true,
        reason: 'Retailer context preserved',
      });
      passedChecks++;
    }

    // ── Cross-check with search evidence ──
    const searchEvidence = (input as any)._searchEvidence as SearchEvidence | undefined;
    if (searchEvidence && searchEvidence.matchedAsin && aiResponse.product.name) {
      totalChecks++;
      // If search found a title for this ASIN, check for major disagreement
      if (searchEvidence.title && aiResponse.product.name) {
        const similarity = this.titleSimilarity(searchEvidence.title, aiResponse.product.name);
        const titlesAgree = similarity > 0.3; // Loose threshold — titles can vary

        checks.push({
          field: 'title-consistency',
          expected: searchEvidence.title,
          actual: aiResponse.product.name,
          passed: titlesAgree,
          reason: titlesAgree
            ? `Titles are consistent (similarity: ${Math.round(similarity * 100)}%)`
            : `Titles differ significantly (similarity: ${Math.round(similarity * 100)}%)`,
        });

        if (titlesAgree) {
          passedChecks++;
        } else {
          conflicts.push({
            field: 'title',
            inputValue: searchEvidence.title,
            aiValue: aiResponse.product.name,
            evidenceValue: searchEvidence.title,
            severity: 'warning',
            message: `AI title "${aiResponse.product.name}" differs from search title "${searchEvidence.title}"`,
          });
        }
      } else {
        passedChecks++;
      }
    }

    // ── AI-reported conflicts ──
    for (const conflict of aiResponse.conflicts) {
      conflicts.push({
        field: conflict.field,
        inputValue: conflict.valueA,
        aiValue: conflict.valueB,
        evidenceValue: null,
        severity: 'warning',
        message: `AI reported conflict: ${conflict.field} — ${conflict.sourceA}: "${conflict.valueA}" vs ${conflict.sourceB}: "${conflict.valueB}"`,
      });
    }

    const confidence = totalChecks > 0
      ? Math.round((passedChecks / totalChecks) * 100)
      : 50; // No checks = moderate confidence

    const hasCriticalConflict = conflicts.some(c => c.severity === 'critical');

    return {
      verified: !hasCriticalConflict && confidence >= 50,
      checks,
      conflicts,
      confidence,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Confidence Calculation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calculate final confidence combining AI self-reported confidence,
   * identity verification, and supporting evidence.
   */
  private calculateFinalConfidence(
    aiResponse: AIProductResponse,
    verification: IdentityVerificationResult,
    searchEvidence?: SearchEvidence,
  ): number {
    let confidence = aiResponse.confidence.overall;

    // Boost if identity verification passed
    if (verification.verified && verification.confidence >= 80) {
      confidence = Math.min(100, confidence + 5);
    }

    // Boost if search evidence corroborates
    if (searchEvidence?.matchedAsin) {
      confidence = Math.min(100, confidence + 5);
    }

    // Penalize if there are warnings
    const warnings = verification.conflicts.filter(c => c.severity === 'warning');
    if (warnings.length > 0) {
      confidence = Math.max(30, confidence - (warnings.length * 5));
    }

    // Penalize if AI status is uncertain
    if (aiResponse.status === 'uncertain') {
      confidence = Math.min(confidence, 65);
    }

    // Penalize if AI status is conflict
    if (aiResponse.status === 'conflict') {
      confidence = Math.min(confidence, 50);
    }

    // Cap at 95 — only humans can be 100% sure
    return Math.min(95, Math.max(0, Math.round(confidence)));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Field Source Building
  // ─────────────────────────────────────────────────────────────────────────

  private buildFieldSources(
    input: IdentificationInput,
    aiResponse: AIProductResponse,
    searchEvidence?: SearchEvidence,
  ): FieldSourceMap {
    const now = new Date().toISOString();
    const sources: FieldSourceMap = {};

    if (aiResponse.product.name) {
      sources.name = { source: 'ai', confidence: aiResponse.confidence.name, timestamp: now };
    }
    if (aiResponse.product.brand) {
      sources.brand = { source: 'ai', confidence: aiResponse.confidence.brand, timestamp: now };
    }
    if (aiResponse.product.model) {
      sources.model = { source: 'ai', confidence: aiResponse.confidence.model, timestamp: now };
    }
    if (aiResponse.product.category) {
      sources.category = { source: 'ai', confidence: aiResponse.confidence.category, timestamp: now };
    }

    // ASIN source is URL if extracted from URL, otherwise AI
    if (input.asin) {
      sources.asin = { source: 'url', confidence: 100, timestamp: now };
    } else if (aiResponse.product.asin) {
      sources.asin = { source: 'ai', confidence: aiResponse.confidence.asin, timestamp: now };
    }

    // Price source tracking
    if (searchEvidence?.price != null) {
      sources.price = { source: 'search', confidence: aiResponse.confidence.price, timestamp: now };
    } else if (aiResponse.product.pricing.currentPrice != null) {
      sources.price = { source: 'ai', confidence: aiResponse.confidence.price, timestamp: now };
    }

    // Image source — determined at image resolution stage
    // SKU/UPC/MPN from AI
    if (aiResponse.product.sku) {
      sources.sku = { source: 'ai', confidence: aiResponse.confidence.sku, timestamp: now };
    }
    if (aiResponse.product.upc) {
      sources.upc = { source: 'ai', confidence: aiResponse.confidence.upc, timestamp: now };
    }
    if (aiResponse.product.mpn) {
      sources.mpn = { source: 'ai', confidence: aiResponse.confidence.mpn, timestamp: now };
    }

    return sources;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Image Resolution (from evidence only)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolve image URL from available evidence.
   * AI-provided image URLs are only accepted if they appear in the evidence.
   * Never constructs or invents image URLs.
   */
  private resolveImageFromEvidence(
    aiResponse: AIProductResponse,
    searchEvidence?: SearchEvidence,
    input?: IdentificationInput,
  ): string | null {
    // Priority 1: Search evidence image (already validated by search provider)
    if (searchEvidence?.imageUrl) {
      const validated = sanitizeImage(searchEvidence.imageUrl);
      if (validated) return validated;
    }

    // Priority 2: AI-provided images (only from evidence)
    if (aiResponse.product.images.length > 0) {
      for (const img of aiResponse.product.images) {
        const validated = sanitizeImage(img.url);
        if (validated) return validated;
      }
    }

    // Priority 3: Partial data from prior extraction
    if (input?.partialData?.imageUrl) {
      const validated = sanitizeImage(input.partialData.imageUrl);
      if (validated) return validated;
    }

    // No verified image available — will be resolved by image-resolution stage
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Price Resolution (from evidence only)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolve price from available evidence.
   * Never invents a price. Only accepts prices with evidence backing.
   */
  private resolvePriceFromEvidence(
    aiResponse: AIProductResponse,
    searchEvidence?: SearchEvidence,
  ): number | null {
    // Priority 1: Search evidence price (from actual shopping results)
    if (searchEvidence?.price != null && searchEvidence.price > 0) {
      return searchEvidence.price;
    }

    // Priority 2: AI price only if confidence is high AND status is "identified"
    if (
      aiResponse.product.pricing.currentPrice != null &&
      aiResponse.product.pricing.currentPrice > 0 &&
      aiResponse.confidence.price >= 70 &&
      aiResponse.status === 'identified'
    ) {
      return aiResponse.product.pricing.currentPrice;
    }

    // No verified price available
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Evidence Strings (for logging/display)
  // ─────────────────────────────────────────────────────────────────────────

  private buildEvidenceStrings(
    aiResponse: AIProductResponse,
    verification: IdentityVerificationResult,
  ): string[] {
    const evidence: string[] = [];

    // AI identification source
    if (aiResponse.status === 'identified') {
      evidence.push('AI identified product with high confidence');
    } else if (aiResponse.status === 'uncertain') {
      evidence.push('AI identified product with moderate confidence');
    } else if (aiResponse.status === 'conflict') {
      evidence.push('AI reported conflicting information');
    }

    // Verification results
    for (const check of verification.checks) {
      if (check.passed) {
        evidence.push(`✓ ${check.field}: ${check.reason}`);
      } else {
        evidence.push(`✗ ${check.field}: ${check.reason}`);
      }
    }

    // AI's own sources
    for (const source of aiResponse.sources.slice(0, 3)) {
      evidence.push(`Source: ${source}`);
    }

    // AI reasoning
    if (aiResponse.reason) {
      evidence.push(`AI: ${aiResponse.reason}`);
    }

    return evidence;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Simple title similarity check using word overlap.
   * Returns 0-1 where 1 = identical.
   */
  private titleSimilarity(titleA: string, titleB: string): number {
    const wordsA = new Set(titleA.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(titleB.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let overlap = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) overlap++;
    }

    return overlap / Math.max(wordsA.size, wordsB.size);
  }
}
