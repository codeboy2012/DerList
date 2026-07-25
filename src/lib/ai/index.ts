/**
 * DerList AI Module — Public API
 *
 * Exports the Shopping AI and Product Getter services for use
 * in server actions and API routes.
 * 
 * This module provides both the new multi-provider AI services
 * and backward compatibility with the old Puter.js-based services.
 */

// ─────────────────────────────────────────────────────────────────────────────
// New Multi-Provider AI Services (Recommended)
// ─────────────────────────────────────────────────────────────────────────────

export {
  chat as shoppingChat,
  ask as shoppingAsk,
  isShoppingAIAvailable,
  type ChatMessage,
  type ShoppingAIResponse,
} from './services/shopping-ai';

export {
  parseProducts as parseProductsWithProvider,
  parseImage as parseImageWithProvider,
  searchProducts as searchProductsWithProvider,
  normalizeProduct as normalizeProductWithProvider,
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

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Puter.js Services (Deprecated - use provider services above)
// ─────────────────────────────────────────────────────────────────────────────

export { chat, ask } from './shopping-ai';
export { parseProducts, parseImage } from './product-getter';
export { isPuterAvailable } from './puter';
