/**
 * DerList AI Module — Public API
 *
 * Multi-provider AI system supporting SerpApi, OpenAI, Anthropic, and more.
 * Provides Shopping AI, Product Getter, and provider management capabilities.
 */

// ─────────────────────────────────────────────────────────────────────────────
// AI Services
// ─────────────────────────────────────────────────────────────────────────────

export {
  chat,
  ask,
  isShoppingAIAvailable,
  type ChatMessage,
  type ShoppingAIResponse,
} from './services/shopping-ai';

export {
  parseProducts,
  parseImage,
  searchProducts,
  normalizeProduct,
  isProductGetterAvailable,
  type ParsedProduct,
  type ProductGetterResult,
  type MatchedProduct,
} from './services/product-getter';

// ─────────────────────────────────────────────────────────────────────────────
// Provider System
// ─────────────────────────────────────────────────────────────────────────────

export {
  getAIProvider,
  getRecommendedProvider,
  getAvailableProviders,
  getProviderMetadata,
  testProviderConfig,
  isAnyProviderAvailable,
  clearProviderCache,
  getProviderStats,
  type AIProvider,
  type ProviderConfig,
  type ProviderMetadata,
  type ProductCandidate,
  type AIMessage,
} from './providers';

/**
 * @deprecated Use isAnyProviderAvailable() instead
 */
export async function isPuterAvailable(): Promise<boolean> {
  try {
    // Import dynamically to avoid circular dependencies
    const { isAnyProviderAvailable } = await import('./providers');
    return await isAnyProviderAvailable();
  } catch {
    return false;
  }
}
