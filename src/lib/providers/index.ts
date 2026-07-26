/**
 * Provider Layer
 *
 * External API integrations. Each provider implements a clean interface.
 * The ProviderManager resolves instances from user config with failover.
 */

// Types
export type {
  AIProvider,
  AIOptions,
  AIResponse,
  Message,
  SearchProvider,
  SearchOptions,
  SearchResult,
  PriceProvider,
  PriceIdType,
  PriceResult,
  PricePoint,
} from './types';

// Implementations
export { OpenRouterProvider, createOpenRouterProvider } from './openrouter';
export { SerpApiProvider, createSerpApiProvider } from './serpapi';
export { KeepaProvider, createKeepaProvider } from './keepa';

// Manager
export { ProviderManager, getProviderManager } from './manager';
