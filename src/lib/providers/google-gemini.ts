/**
 * Google Gemini API Provider
 *
 * Direct access to Gemini models via the Google AI Studio API (generativelanguage.googleapis.com).
 * Simpler setup than Vertex AI — just needs an API key from AI Studio.
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent
 */

import type { AIOptions, AIProvider, AIResponse, Message } from './types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';

interface GeminiConfig {
  apiKey: string;
  model?: string;
}

function toGeminiFormat(messages: Message[]): {
  systemInstruction?: { parts: { text: string }[] };
  contents: { role: string; parts: { text: string }[] }[];
} {
  const system = messages.filter((m) => m.role === 'system');
  const conversation = messages.filter((m) => m.role !== 'system');

  const systemInstruction =
    system.length > 0
      ? { parts: [{ text: system.map((m) => m.content).join('\n\n') }] }
      : undefined;

  const contents = conversation.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  return { systemInstruction, contents };
}

export class GoogleGeminiProvider implements AIProvider {
  readonly id = 'google';
  readonly name = 'Google Gemini';

  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model?.trim() || DEFAULT_MODEL;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(messages: Message[], options?: AIOptions): Promise<AIResponse> {
    const model = options?.model ?? this.model;
    const maxTokens = options?.maxTokens ?? 1024;
    const temperature = options?.temperature ?? 0.7;

    const { systemInstruction, contents } = toGeminiFormat(messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    if (options?.json) {
      (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
    }

    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const sanitized = errorText.replace(/key=[^&\s"]+/gi, 'key=***');
      throw new Error(`Google Gemini API error (${response.status}): ${sanitized}`);
    }

    const data = await response.json();

    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts?.[0]?.text) {
      const blockReason = candidate?.finishReason ?? data.promptFeedback?.blockReason;
      throw new Error(
        blockReason
          ? `Google Gemini: Response blocked (${blockReason})`
          : 'Google Gemini returned empty response'
      );
    }

    const content = candidate.content.parts.map((p: { text: string }) => p.text).join('');
    const usage = data.usageMetadata;

    return {
      content,
      model,
      tokensUsed: usage
        ? (usage.promptTokenCount ?? 0) + (usage.candidatesTokenCount ?? 0)
        : undefined,
      finishReason: candidate.finishReason,
    };
  }
}

export function createGoogleGeminiProvider(
  config: Record<string, unknown>
): GoogleGeminiProvider | null {
  const apiKey = config.apiKey as string | undefined;
  if (!apiKey) return null;

  return new GoogleGeminiProvider({
    apiKey,
    model: (config.model as string) || undefined,
  });
}
