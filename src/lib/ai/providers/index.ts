/**
 * AI Provider System
 * 
 * Central export for all AI providers and the registry system.
 * New providers should be registered here.
 */

import { registry } from './registry';
import { SerpApiProvider, SerpApiMetadata } from './serpapi';
import { OpenAIProvider, OpenAIMetadata } from './openai';
import { getRecommendedProvider } from './registry';

// ─────────────────────────────────────────────────────────────────────────────
// Provider Registration
// ─────────────────────────────────────────────────────────────────────────────

// Register all available providers
registry.register('serpapi', SerpApiProvider, SerpApiMetadata);
registry.register('openai', OpenAIProvider, OpenAIMetadata);

// TODO: Register additional providers
// registry.register('anthropic', AnthropicProvider, AnthropicMetadata);
// registry.register('google', GoogleProvider, GoogleMetadata);
// registry.register('openrouter', OpenRouterProvider, OpenRouterMetadata);
// registry.register('ollama', OllamaProvider, OllamaMetadata);
// registry.register('lmstudio', LMStudioProvider, LMStudioMetadata);

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

// Main functions for getting providers
export {
  getAIProvider,
  getRecommendedProvider,
  testProviderConfig,
  registry as providerRegistry,
} from './registry';

// Types for external use
export type {
  AIProvider,
  ProviderConfig,
  ProviderMetadata,
  ProductCandidate,
  ProductSearchResult,
  AIMessage,
  ChatResponse,
  IdentifyProductOptions,
  SearchProductsOptions,
  ChatOptions,
  AnalyzeImageOptions,
  NormalizeProductOptions,
  RawProductData,
  NormalizedProduct,
  AIProviderError,
  AIProviderConfigError,
  AIProviderUnavailableError,
} from './types';

// Provider classes (for direct instantiation if needed)
export { SerpApiProvider, OpenAIProvider };
export { SerpApiMetadata, OpenAIMetadata };

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all available provider metadata
 */
export function getAvailableProviders() {
  return registry.getAvailableProviders();
}

/**
 * Get metadata for a specific provider
 */
export function getProviderMetadata(providerId: string) {
  return registry.getProviderMetadata(providerId);
}

/**
 * Clear provider cache (useful after configuration changes)
 */
export function clearProviderCache(providerId?: string) {
  return registry.clearCache(providerId);
}

/**
 * Check if any AI provider is available
 */
export async function isAnyProviderAvailable(): Promise<boolean> {
  try {
    await getRecommendedProvider();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get provider statistics (for admin/debugging)
 */
export function getProviderStats() {
  const providers = getAvailableProviders();
  
  return {
    totalProviders: providers.length,
    freeProviders: providers.filter(p => p.pricing?.type === 'free').length,
    paidProviders: providers.filter(p => p.pricing?.type === 'paid').length,
    freemiumProviders: providers.filter(p => p.pricing?.type === 'freemium').length,
    featuresSupported: {
      chat: providers.filter(p => p.features.chat).length,
      vision: providers.filter(p => p.features.vision).length,
      tools: providers.filter(p => p.features.tools).length,
      search: providers.filter(p => p.features.search).length,
      identifyProduct: providers.filter(p => p.features.identifyProduct).length,
      normalizeProduct: providers.filter(p => p.features.normalizeProduct).length,
    },
    providers: providers.map(p => ({
      id: p.id,
      name: p.name,
      pricing: p.pricing?.type || 'unknown',
      features: Object.entries(p.features)
        .filter(([, supported]) => supported)
        .map(([feature]) => feature),
    })),
  };
}