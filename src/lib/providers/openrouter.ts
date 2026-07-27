/**
 * OpenRouter AI Provider
 *
 * Implements AIProvider using the OpenRouter API.
 * Compatible with OpenAI chat completions format.
 *
 * Model selection:
 * - If user specifies a model, use it.
 * - If blank/null, use 'openrouter/auto' (auto-routes to best available).
 * - If that fails, retry with fallback free models automatically.
 */

import type { AIOptions, AIProvider, AIResponse, Message } from './types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AUTO_MODEL = 'openrouter/auto';
const DEFAULT_MAX_TOKENS = 1024;

/** Fallback models if the primary/auto model fails */
const FALLBACK_MODELS = [
  'openrouter/auto',
  'meta-llama/llama-4-maverick:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'qwen/qwen3-235b-a22b:free',
];

/** Errors that indicate the model is unavailable (retryable) */
function isModelError(status: number, body: string): boolean {
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
    // Empty string or null → use auto model
    this.model = config.model?.trim() || AUTO_MODEL;
    this.baseUrl = config.baseUrl ?? OPENROUTER_API_URL;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(messages: Message[], options?: AIOptions): Promise<AIResponse> {
    const requestedModel = options?.model ?? this.model;
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const temperature = options?.temperature ?? 0.7;

    // Build the list of models to try
    const modelsToTry = [requestedModel];
    // If the requested model isn't already in fallbacks, add fallbacks
    for (const fallback of FALLBACK_MODELS) {
      if (!modelsToTry.includes(fallback)) {
        modelsToTry.push(fallback);
      }
    }

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const result = await this.makeRequest(
          model,
          messages,
          maxTokens,
          temperature,
          options?.json
        );

        // Log which model was used (dev mode)
        if (process.env.NODE_ENV === 'development' && model !== requestedModel) {
          console.log(
            `[OpenRouter] Requested: ${requestedModel} → Used: ${model} → Actual: ${result.model}`
          );
        }

        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);

        // Extract status from error message
        const statusMatch = msg.match(/\((\d{3})\)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 0;

        // If it's a model error, try the next model
        if (isModelError(status, msg)) {
          lastError = error instanceof Error ? error : new Error(msg);
          continue;
        }

        // For non-model errors (auth, rate limit, network), don't retry with different models
        throw error;
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
      const error = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${error}`);
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
