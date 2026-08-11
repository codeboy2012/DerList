/**
 * Provider Manager
 *
 * Resolves provider instances from user configuration.
 * Handles failover: if the primary provider fails, tries the next by priority.
 * Does NOT contain business logic — just provider resolution.
 */

import { ProviderRepository, type ProviderConfig } from '@/lib/repositories';
import { createAnthropicProvider } from './anthropic';
import { createGoogleGeminiProvider } from './google-gemini';
import { createGoogleVertexProvider } from './google-vertex';
import { createKeepaProvider } from './keepa';
import { createOpenRouterProvider } from './openrouter';
import { createSerpApiProvider } from './serpapi';
import type { AIProvider, PriceProvider, SearchProvider } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Provider Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a provider instance from a stored configuration.
 */
function createProviderFromConfig(
  config: ProviderConfig
): AIProvider | SearchProvider | PriceProvider | null {
  switch (config.providerId) {
    // ── AI Providers ──

    case 'openrouter':
      return createOpenRouterProvider(config.config);

    case 'openai':
      // OpenAI is OpenAI-compatible — use OpenRouter provider with OpenAI base URL
      return createOpenRouterProvider({
        ...config.config,
        baseUrl: (config.config.baseUrl as string) || 'https://api.openai.com/v1/chat/completions',
      });

    case 'anthropic':
      return createAnthropicProvider(config.config);

    case 'google':
      return createGoogleGeminiProvider(config.config);

    case 'google-vertex':
      return createGoogleVertexProvider(config.config);

    case 'xai':
    case 'mistral':
    case 'deepseek':
    case 'groq':
    case 'cerebras':
    case 'together':
    case 'fireworks':
    case 'perplexity':
      // These providers use OpenAI-compatible chat/completions API
      return createOpenRouterProvider({
        apiKey: config.config.apiKey as string,
        model: config.config.model as string,
        baseUrl: getOpenAICompatibleBaseUrl(config.providerId, config.config),
      });

    case 'ollama':
    case 'lmstudio':
      // Local providers — OpenAI-compatible with custom base URL, no API key required
      return createOpenRouterProvider({
        apiKey: (config.config.apiKey as string) || 'not-needed',
        model: config.config.model as string,
        baseUrl: getLocalProviderUrl(config.providerId, config.config),
      });

    case 'azure-openai':
      // Azure uses OpenAI-compatible format with a specific endpoint
      return createOpenRouterProvider({
        apiKey: config.config.apiKey as string,
        model: config.config.model as string,
        baseUrl: `${config.config.baseUrl}/openai/deployments/${config.config.model || 'gpt-4o'}/chat/completions?api-version=2024-02-01`,
      });

    // ── Search Providers ──

    case 'serpapi':
      return createSerpApiProvider(config.config);

    // ── Price Providers ──

    case 'keepa':
      return createKeepaProvider(config.config);

    default:
      return null;
  }
}

/**
 * Get the base URL for OpenAI-compatible providers.
 */
function getOpenAICompatibleBaseUrl(
  providerId: string,
  config: Record<string, unknown>
): string {
  // Allow custom base URL override
  if (config.baseUrl && typeof config.baseUrl === 'string') {
    return config.baseUrl;
  }

  const urls: Record<string, string> = {
    xai: 'https://api.x.ai/v1/chat/completions',
    mistral: 'https://api.mistral.ai/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    cerebras: 'https://api.cerebras.ai/v1/chat/completions',
    together: 'https://api.together.xyz/v1/chat/completions',
    fireworks: 'https://api.fireworks.ai/inference/v1/chat/completions',
    perplexity: 'https://api.perplexity.ai/chat/completions',
  };

  return urls[providerId] ?? 'https://api.openai.com/v1/chat/completions';
}

/**
 * Get the base URL for local inference providers.
 */
function getLocalProviderUrl(
  providerId: string,
  config: Record<string, unknown>
): string {
  if (config.baseUrl && typeof config.baseUrl === 'string') {
    return config.baseUrl;
  }

  const defaults: Record<string, string> = {
    ollama: 'http://localhost:11434/v1/chat/completions',
    lmstudio: 'http://localhost:1234/v1/chat/completions',
  };

  return defaults[providerId] ?? 'http://localhost:11434/v1/chat/completions';
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Manager
// ─────────────────────────────────────────────────────────────────────────────

export class ProviderManager {
  /**
   * Get all available AI providers for a user, ordered by priority.
   */
  async getAIProviders(userId: string): Promise<AIProvider[]> {
    const configs = await ProviderRepository.listByCategory(userId, 'AI');
    const providers: AIProvider[] = [];

    for (const config of configs) {
      const provider = createProviderFromConfig(config);
      if (provider && 'chat' in provider && provider.isAvailable()) {
        providers.push(provider as AIProvider);
      }
    }

    return providers;
  }

  /**
   * Get the best available AI provider for a user.
   * Returns null if no AI provider is configured.
   */
  async getAIProvider(userId: string): Promise<AIProvider | null> {
    const providers = await this.getAIProviders(userId);
    return providers[0] ?? null;
  }

  /**
   * Get all available search providers for a user, ordered by priority.
   */
  async getSearchProviders(userId: string): Promise<SearchProvider[]> {
    const configs = await ProviderRepository.listByCategory(userId, 'SHOPPING_SEARCH');
    const providers: SearchProvider[] = [];

    for (const config of configs) {
      const provider = createProviderFromConfig(config);
      if (provider && 'search' in provider && provider.isAvailable()) {
        providers.push(provider as SearchProvider);
      }
    }

    return providers;
  }

  /**
   * Get the best available search provider for a user.
   */
  async getSearchProvider(userId: string): Promise<SearchProvider | null> {
    const providers = await this.getSearchProviders(userId);
    return providers[0] ?? null;
  }

  /**
   * Get all available price providers for a user, ordered by priority.
   */
  async getPriceProviders(userId: string): Promise<PriceProvider[]> {
    const configs = await ProviderRepository.listByCategory(userId, 'PRICE');
    const providers: PriceProvider[] = [];

    for (const config of configs) {
      const provider = createProviderFromConfig(config);
      if (provider && 'getCurrentPrice' in provider && provider.isAvailable()) {
        providers.push(provider as PriceProvider);
      }
    }

    return providers;
  }

  /**
   * Get the best available price provider for a user.
   */
  async getPriceProvider(userId: string): Promise<PriceProvider | null> {
    const providers = await this.getPriceProviders(userId);
    return providers[0] ?? null;
  }

  /**
   * Execute an AI operation with automatic failover.
   * Tries each provider in priority order until one succeeds.
   */
  async withAIFailover<T>(
    userId: string,
    operation: (provider: AIProvider) => Promise<T>
  ): Promise<T> {
    const providers = await this.getAIProviders(userId);

    if (providers.length === 0) {
      throw new Error('No AI provider configured. Add one in Settings → Providers.');
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        return await operation(provider);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next provider
      }
    }

    throw lastError ?? new Error('All AI providers failed.');
  }

  /**
   * Execute a search operation with automatic failover.
   */
  async withSearchFailover<T>(
    userId: string,
    operation: (provider: SearchProvider) => Promise<T>
  ): Promise<T> {
    const providers = await this.getSearchProviders(userId);

    if (providers.length === 0) {
      throw new Error('No search provider configured. Add one in Settings → Providers.');
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        return await operation(provider);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error('All search providers failed.');
  }

  /**
   * Execute a price lookup with automatic failover.
   */
  async withPriceFailover<T>(
    userId: string,
    operation: (provider: PriceProvider) => Promise<T>
  ): Promise<T> {
    const providers = await this.getPriceProviders(userId);

    if (providers.length === 0) {
      throw new Error('No price provider configured. Add one in Settings → Providers.');
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        return await operation(provider);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error('All price providers failed.');
  }

  /**
   * Check if a user has any AI provider configured.
   */
  async hasAI(userId: string): Promise<boolean> {
    const provider = await this.getAIProvider(userId);
    return provider !== null;
  }

  /**
   * Check if a user has any search provider configured.
   */
  async hasSearch(userId: string): Promise<boolean> {
    const provider = await this.getSearchProvider(userId);
    return provider !== null;
  }

  /**
   * Check if a user has any price provider configured.
   */
  async hasPrice(userId: string): Promise<boolean> {
    const provider = await this.getPriceProvider(userId);
    return provider !== null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────────────────────

let instance: ProviderManager | null = null;

/**
 * Get the ProviderManager singleton.
 */
export function getProviderManager(): ProviderManager {
  if (!instance) {
    instance = new ProviderManager();
  }
  return instance;
}
