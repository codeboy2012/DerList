/**
 * Puter.js singleton and typed chat wrapper for server-side usage.
 *
 * COMPATIBILITY NOTE:
 * The Puter.js runtime (AI.js) supports message arrays, tool calling, streaming,
 * and all OpenAI-compatible chat features. However, the published TypeScript
 * definitions (types/modules/ai.d.ts) only expose `chat(prompt: string)`.
 *
 * This wrapper isolates the type cast in ONE place so the rest of the codebase
 * gets proper typing without touching node_modules.
 *
 * Once Puter publishes correct typings, only this file needs updating.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { init } = require('@heyputer/puter.js/src/init.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single message in the conversation (OpenAI-compatible format). */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: AIToolCall[];
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** Options passed to puter.ai.chat alongside messages. */
export interface AIChatOptions {
  model?: string;
  tools?: unknown[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

/** Shape of a non-streaming chat response from Puter.js. */
export interface AIChatResponse {
  message: {
    role: string;
    content: string | Array<{ text?: string; type?: string }> | null;
    tool_calls?: AIToolCall[];
  };
}

// Internal: the actual Puter instance shape (minimal, just for the singleton)
type PuterInstance = {
  ai: {
    chat: (...args: unknown[]) => Promise<unknown>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────────────────────

let puterInstance: PuterInstance | null = null;

/**
 * Get the Puter.js instance. Returns null if PUTER_AUTH_TOKEN is not set
 * or initialization fails.
 */
export function getPuter(): PuterInstance | null {
  const token = process.env.PUTER_AUTH_TOKEN;
  if (!token) return null;

  if (puterInstance) return puterInstance;

  try {
    puterInstance = init(token) as PuterInstance;
    return puterInstance;
  } catch (error) {
    console.error('[Puter] Failed to initialize:', error);
    puterInstance = null;
    return null;
  }
}

/**
 * Check whether Puter.js is configured (token exists).
 */
export function isPuterAvailable(): boolean {
  return Boolean(process.env.PUTER_AUTH_TOKEN);
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed Chat Wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a message-array chat request to Puter.js AI.
 *
 * This is the ONLY place in the codebase that casts puter.ai.chat.
 * All other files should import and call this function.
 *
 * Supports:
 * - Message arrays (system/user/assistant/tool roles)
 * - Tool calling (tools option)
 * - Model selection
 * - Streaming (stream option)
 * - Temperature and other provider options
 *
 * @throws Error if Puter is not available
 */
export async function puterChat(
  messages: AIMessage[],
  options?: AIChatOptions,
): Promise<AIChatResponse> {
  const puter = getPuter();
  if (!puter) {
    throw new Error('Puter AI is not available. Set PUTER_AUTH_TOKEN in your environment.');
  }

  // The runtime accepts (messages, options) but typings only declare (string).
  // Cast once here to bridge the gap.
  const chatFn = puter.ai.chat as (
    messages: AIMessage[],
    options?: AIChatOptions,
  ) => Promise<AIChatResponse>;

  return chatFn(messages, options);
}

/**
 * Send a vision/media chat request to Puter.js AI.
 *
 * Used for image analysis — passes prompt + media URL.
 * Puter runtime signature: chat(prompt, mediaUrl, testMode, options)
 */
export async function puterChatWithMedia(
  prompt: string,
  mediaUrl: string,
  options?: AIChatOptions,
): Promise<AIChatResponse> {
  const puter = getPuter();
  if (!puter) {
    throw new Error('Puter AI is not available. Set PUTER_AUTH_TOKEN in your environment.');
  }

  // Runtime signature: chat(prompt, media, testMode, options)
  const chatFn = puter.ai.chat as (
    prompt: string,
    media: string,
    testMode: boolean,
    options?: AIChatOptions,
  ) => Promise<AIChatResponse>;

  return chatFn(prompt, mediaUrl, false, options);
}
