/**
 * AI Provider Adapters — supports Gemini, OpenAI, Anthropic, and Ollama.
 * All providers are optional — imported dynamically only when needed.
 */

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'ollama';

export interface AIResponse {
  text: string;
}

/**
 * Send a prompt to the configured AI provider.
 * Returns null if the provider is not configured or fails.
 */
export async function queryAI(prompt: string): Promise<AIResponse | null> {
  const provider = getConfiguredProvider();
  if (!provider) return null;

  try {
    switch (provider) {
      case 'gemini':
        return await queryGemini(prompt);
      case 'openai':
        return await queryOpenAI(prompt);
      case 'anthropic':
        return await queryAnthropic(prompt);
      case 'ollama':
        return await queryOllama(prompt);
      default:
        return null;
    }
  } catch (err) {
    console.warn(
      `[AI] Provider ${provider} failed:`,
      err instanceof Error ? err.message : 'Unknown'
    );
    return null;
  }
}

function getConfiguredProvider(): AIProvider | null {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OLLAMA_BASE_URL) return 'ollama';
  return null;
}

async function queryGemini(prompt: string): Promise<AIResponse> {
  // @ts-expect-error — optional dependency, only used when GEMINI_API_KEY is set
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash' });
  const result = await model.generateContent(prompt);
  return { text: result.response.text() };
}

async function queryOpenAI(prompt: string): Promise<AIResponse> {
  // @ts-expect-error — optional dependency, only used when OPENAI_API_KEY is set
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 512,
  });
  return { text: resp.choices[0]?.message?.content ?? '' };
}

async function queryAnthropic(prompt: string): Promise<AIResponse> {
  // @ts-expect-error — optional dependency, only used when ANTHROPIC_API_KEY is set
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const resp = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = resp.content[0];
  return { text: block.type === 'text' ? block.text : '' };
}

async function queryOllama(prompt: string): Promise<AIResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL!;
  const model = process.env.OLLAMA_MODEL ?? 'llama3';
  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false }),
  });
  const data = await resp.json();
  return { text: data?.message?.content ?? '' };
}
