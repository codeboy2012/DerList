/**
 * OpenRouter AI Provider
 *
 * Implements AIProvider using the OpenRouter API.
 * Compatible with OpenAI chat completions format.
 * Supports free models when no API key is provided.
 */

import type { AIOptions, AIProvider, AIResponse, Message } from './types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';
const DEFAULT_MAX_TOKENS = 1024;

interface OpenRouterConfig {
  apiKey: string;
  model?: string;
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
    this.model = config.model ?? DEFAULT_MODEL;
    this.baseUrl = config.baseUrl ?? OPENROUTER_API_URL;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(messages: Message[], options?: AIOptions): Promise<AIResponse> {
    const model = options?.model ?? this.model;
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const temperature = options?.temperature ?? 0.7;

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    if (options?.json) {
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
    model: (config.model as string) ?? undefined,
    baseUrl: (config.baseUrl as string) ?? undefined,
  });
}
