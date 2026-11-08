/**
 * Provider capability registry.
 *
 * The settings catalog is intentionally broad, but only providers listed here
 * can actually be constructed by `ProviderManager`. Advertising an entry the
 * factory cannot build lets users save a provider that silently does nothing.
 *
 * When a new provider implementation is added, add its id here AND add a case
 * to `createProviderFromConfig`. The test in
 * `tests/providers/implemented-providers.test.ts` fails if the two drift for
 * the providers we claim to support.
 */

export type ImplementedProviderCategory = 'ai' | 'search' | 'price';

export const IMPLEMENTED_PROVIDER_IDS: Record<ImplementedProviderCategory, ReadonlySet<string>> = {
  ai: new Set([
    'openrouter',
    'openai',
    'anthropic',
    'google',
    'google-vertex',
    'google-vertex-derlist',
    'xai',
    'mistral',
    'deepseek',
    'groq',
    'cerebras',
    'together',
    'fireworks',
    'perplexity',
    'ollama',
    'lmstudio',
    'azure-openai',
  ]),
  search: new Set(['serpapi', 'brave']),
  price: new Set(['keepa']),
};

export function isProviderImplemented(category: string, providerId: string): boolean {
  const implemented = IMPLEMENTED_PROVIDER_IDS[category as ImplementedProviderCategory];
  return implemented ? implemented.has(providerId) : false;
}
