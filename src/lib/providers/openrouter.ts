/**
 * OpenRouter AI Provider
 *
 * Model selection:
 * - If user specifies a model → use it.
 * - If blank/null → 'openrouter/free' (Free Models Router, no credits needed).
 * - On failure (model error or 402 billing) → retry free fallback models.
 *
 * A user with zero credits can always use free models without errors.
 */

import type { AIOptions, AIProvider, AIResponse, Message } from './types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Default model for users who leave the field blank — requires NO credits */
const FREE_ROUTER = 'openrouter/free';

const DEFAULT_MAX_TOKENS = 1024;

/** Fallback free models if the primary fails */
const FREE_FALLBACKS = [
  'openrouter/free',
  'meta-llama/llama-4-maverick:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'qwen/qwen3-235b-a22b:free',
];

/** Check if a model is known to be free (no credits needed) */
function isFreeModel(model: string): boolean {
  return model === 'openrouter/free' || model.endsWith(':free');
}

/** Errors where we should retry with a different model */
function isRetryableModelError(status: number, body: string): boolean {
  if (status === 404) return true;
  const lower = body.toLowerCase();
  return (
    lower.includes('no models provided') ||
    lower.includes('model_not_found') ||
    lower.includes('model not found') ||
    lower.includes('unavailable') ||
    lower.includes('provider unavailable') ||
    lower.includes('does not exist') ||
    (status === 400 && lower.includes('model'))
  );
}

/** 402 billing error — retryable if we can switch to a free model */
function isBillingError(status: number, body: string): boolean {
  if (status !== 402) return false;
  const lower = body.toLowerCase();
  return lower.includes('credit') || lower.includes('billing') || lower.includes('insufficient');
}

interface OpenRouterConfig {
  apiKey: string;
  model?: string | null;
  baseUrl?: string;
}

export class OpenRouterProvider implements AIProvider {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter';

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: OpenRouterConfig) {
    this.apiKey = config.apiKey;
    // Empty/null → FREE router (not 'auto' which may route to paid)
    this.model = config.model?.trim() || FREE_ROUTER;
    this.baseUrl = config.baseUrl ?? OPENROUTER_API_URL;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(messages: Message[], options?: AIOptions): Promise<AIResponse> {
    const requestedModel = options?.model ?? this.model;
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const temperature = options?.temperature ?? 0.7;

    // Build retry list: requested model first, then free fallbacks
    const modelsToTry = [requestedModel];
    for (const fb of FREE_FALLBACKS) {
      if (!modelsToTry.includes(fb)) modelsToTry.push(fb);
    }

    let lastError: Error | null = null;
    let attempt = 0;

    for (const model of modelsToTry) {
      attempt++;
      const isFallback = model !== requestedModel;

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[OpenRouter] Attempt ${attempt} | Requested: ${requestedModel} | Sending: ${model} | Fallback: ${isFallback}`
        );
      }

      try {
        const result = await this.makeRequest(
          model,
          messages,
          maxTokens,
          temperature,
          options?.json
        );

        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[OpenRouter] Success | Sent: ${model} | Actual: ${result.model} | Tokens: ${result.tokensUsed ?? '?'}`
          );
        }

        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const statusMatch = msg.match(/\((\d{3})\)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 0;

        // 402 billing error — retry with free models
        if (isBillingError(status, msg)) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[OpenRouter] 402 billing error on model: ${model} — retrying free models`);
          }
          lastError = error instanceof Error ? error : new Error(msg);
          continue; // Try next (free) model
        }

        // Model-specific errors — retry next model
        if (isRetryableModelError(status, msg)) {
          lastError = error instanceof Error ? error : new Error(msg);
          continue;
        }

        // Auth errors (401/403) — don't retry, key is bad
        if (status === 401 || status === 403) {
          throw error;
        }

        // Rate limit (429) — throw for higher-level failover
        if (status === 429) {
          throw error;
        }

        // Unknown error — store and try next
        lastError = error instanceof Error ? error : new Error(msg);
        continue;
      }
    }

    // All models failed
    throw lastError ?? new Error('All OpenRouter models unavailable');
  }

  private async makeRequest(
    model: string,
    messages: Message[],
    maxTokens: number,
    temperature: number,
    json?: boolean
  ): Promise<AIResponse> {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    if (json) {
      body.response_format = { type: 'json_object' };
    }

    // Verify the model in the payload matches what we intend
    if (process.env.NODE_ENV === 'development') {
      const payload = JSON.parse(JSON.stringify(body));
      if (payload.model !== model) {
        console.error(`[OpenRouter] MISMATCH: intended ${model}, payload has ${payload.model}`);
      }
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://derlist.app',
        'X-Title': 'DerList',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice?.message?.content) {
      throw new Error('OpenRouter returned empty response');
    }

    return {
      content: choice.message.content,
      model: data.model ?? model,
      tokensUsed: data.usage?.total_tokens,
      finishReason: choice.finish_reason,
    };
  }
}

/**
 * Create an OpenRouter provider from a config object.
 * Returns null if config is missing required fields.
 */
export function createOpenRouterProvider(
  config: Record<string, unknown>
): OpenRouterProvider | null {
  const apiKey = config.apiKey as string | undefined;
  if (!apiKey) return null;

  return new OpenRouterProvider({
    apiKey,
    model: (config.model as string) || null,
    baseUrl: (config.baseUrl as string) ?? undefined,
  });
}
