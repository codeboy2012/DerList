/**
 * Anthropic AI Provider
 *
 * Native Anthropic API implementation (not routed through OpenRouter).
 * Supports Claude models with proper message format.
 */

import type { AIOptions, AIProvider, AIResponse, Message } from './types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 1024;

interface AnthropicConfig {
  apiKey: string;
  model?: string | null;
}

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';

  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: AnthropicConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model?.trim() || DEFAULT_MODEL;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(messages: Message[], options?: AIOptions): Promise<AIResponse> {
    const model = options?.model ?? this.model;
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const temperature = options?.temperature ?? 0.7;

    // Anthropic separates system messages from the conversation
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: conversationMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemMessages.length > 0) {
      body.system = systemMessages.map((m) => m.content).join('\n\n');
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    const content =
      data.content
        ?.filter((block: { type: string }) => block.type === 'text')
        .map((block: { text: string }) => block.text)
        .join('') ?? '';

    if (!content) {
      throw new Error('Anthropic returned empty response');
    }

    return {
      content,
      model: data.model ?? model,
      tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      finishReason: data.stop_reason,
    };
  }
}

export function createAnthropicProvider(config: Record<string, unknown>): AnthropicProvider | null {
  const apiKey = config.apiKey as string | undefined;
  if (!apiKey) return null;

  return new AnthropicProvider({
    apiKey,
    model: (config.model as string) || null,
  });
}
