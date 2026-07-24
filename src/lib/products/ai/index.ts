/**
 * AI Verification Module — Optional layer for resolving low-confidence extractions.
 *
 * IMPORTANT: AI is NEVER the primary extraction method.
 * It only verifies when deterministic extraction produces low confidence.
 */

import type { PriceCandidateInfo } from '../engine/types';
import { prepareHtmlForAI, VERIFY_PRICE_PROMPT } from './prompts';
import { queryAI } from './providers';

export interface AIVerificationInput {
  html: string;
  url: string;
  extractedPrice: number | null;
  currency: string | null;
  candidates: PriceCandidateInfo[];
}

export interface AIVerificationResult {
  isCorrect: boolean;
  suggestedPrice: number | null;
  currency: string | null;
  confidence: number;
  reason: string;
}

/**
 * Check if AI verification is configured (any provider has API keys set).
 */
export function isAIConfigured(): boolean {
  return !!(
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OLLAMA_BASE_URL
  );
}

/**
 * Verify an extracted price using AI.
 * Returns null if AI is not configured or verification fails.
 *
 * Only call this when:
 * - Extraction confidence < 70%
 * - Multiple extractors disagree on price
 */
export async function verifyWithAI(
  input: AIVerificationInput,
): Promise<AIVerificationResult | null> {
  if (!isAIConfigured()) return null;

  const preparedHtml = prepareHtmlForAI(input.html);
  const prompt = VERIFY_PRICE_PROMPT
    .replace('$PRICE$', input.extractedPrice?.toString() ?? 'unknown')
    .replace('$CURRENCY$', input.currency ?? 'USD')
    .replace('$URL$', input.url)
    .replace('$HTML$', preparedHtml);

  const response = await queryAI(prompt);
  if (!response) return null;

  // Parse AI response
  try {
    // Extract JSON from response (AI might wrap in markdown code blocks)
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      isCorrect: Boolean(parsed.isCorrect),
      suggestedPrice: typeof parsed.suggestedPrice === 'number' ? parsed.suggestedPrice : null,
      currency: typeof parsed.currency === 'string' ? parsed.currency : null,
      confidence: typeof parsed.confidence === 'number' ? Math.min(parsed.confidence, 100) : 50,
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'AI verification',
    };
  } catch {
    return null;
  }
}
