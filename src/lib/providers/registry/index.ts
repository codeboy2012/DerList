/**
 * Provider Registry — Central registration and resolution of all providers.
 *
 * Architecture:
 * - Providers register themselves with the registry
 * - Consumers request providers by category
 * - Registry handles: selection, failover, circuit breaking, metrics
 * - Adding a new provider = implement interface + register
 *
 * Usage:
 *   registry.register(new OpenAIProvider(config));
 *   const ai = registry.getAI(); // Returns healthiest AI provider
 */

import { canRequest, getCircuitState, recordFailure, recordSuccess } from './circuit-breaker';
import {
  getAllMetrics,
  getProviderMetrics,
  recordRequestFailure,
  recordRequestSuccess,
} from './metrics';
import type {
  AIProviderInterface,
  BaseProvider,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  PriceProviderInterface,
  ProviderCategoryType,
  ProviderMetrics,
  ReviewProviderInterface,
  SearchProviderInterface,
  ShippingProviderInterface,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

class ProviderRegistry {
  private providers = new Map<string, BaseProvider>();
  private priorities = new Map<string, number>(); // providerId → priority (lower = higher)

  /**
   * Register a provider. Lower priority number = tried first.
   */
  register(provider: BaseProvider, priority = 10): void {
    this.providers.set(provider.id, provider);
    this.priorities.set(provider.id, priority);
  }

  /**
   * Unregister a provider.
   */
  unregister(id: string): void {
    this.providers.delete(id);
    this.priorities.delete(id);
  }

  /**
   * Get all registered providers of a category, sorted by priority.
   */
  getByCategory<T extends BaseProvider>(category: ProviderCategoryType): T[] {
    return [...this.providers.values()]
      .filter((p) => p.category === category && p.isAvailable())
      .sort((a, b) => (this.priorities.get(a.id) ?? 99) - (this.priorities.get(b.id) ?? 99)) as T[];
  }

  /**
   * Get the healthiest available AI provider.
   */
  getAI(): AIProviderInterface | null {
    const providers = this.getByCategory<AIProviderInterface>('ai');
    return providers.find((p) => canRequest(p.id)) ?? null;
  }

  /**
   * Get all available AI providers (for failover).
   */
  getAllAI(): AIProviderInterface[] {
    return this.getByCategory<AIProviderInterface>('ai').filter((p) => canRequest(p.id));
  }

  /**
   * Get the healthiest search provider.
   */
  getSearch(): SearchProviderInterface | null {
    const providers = this.getByCategory<SearchProviderInterface>('search');
    return providers.find((p) => canRequest(p.id)) ?? null;
  }

  /**
   * Get the healthiest price provider.
   */
  getPrice(): PriceProviderInterface | null {
    const providers = this.getByCategory<PriceProviderInterface>('price');
    return providers.find((p) => canRequest(p.id)) ?? null;
  }

  /**
   * Execute an AI generation with automatic failover across all AI providers.
   */
  async generateWithFailover(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult & { providerId: string }> {
    const providers = this.getAllAI();
    if (providers.length === 0) {
      throw new Error('No AI providers available');
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      if (!canRequest(provider.id)) continue;

      const start = Date.now();
      try {
        const result = await provider.generate(messages, options);
        const latency = Date.now() - start;

        recordSuccess(provider.id);
        recordRequestSuccess(provider.id, latency);

        return { ...result, providerId: provider.id, latencyMs: latency };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        recordFailure(provider.id);
        recordRequestFailure(provider.id, msg);
        lastError = error instanceof Error ? error : new Error(msg);
      }
    }

    throw lastError ?? new Error('All AI providers failed');
  }

  /**
   * Get metrics for all providers.
   */
  getMetrics(): ProviderMetrics[] {
    return getAllMetrics();
  }

  /**
   * Get metrics for a specific provider.
   */
  getProviderMetrics(id: string): ProviderMetrics {
    return getProviderMetrics(id);
  }

  /**
   * List all registered providers with their status.
   */
  listAll(): Array<{
    id: string;
    name: string;
    category: ProviderCategoryType;
    available: boolean;
    circuit: string;
    priority: number;
  }> {
    return [...this.providers.values()].map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      available: p.isAvailable(),
      circuit: getCircuitState(p.id),
      priority: this.priorities.get(p.id) ?? 99,
    }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────────────────────

let _registry: ProviderRegistry | null = null;

export function getRegistry(): ProviderRegistry {
  if (!_registry) {
    _registry = new ProviderRegistry();
  }
  return _registry;
}

// Re-export everything
export { ProviderRegistry };
export * from './types';
export * from './circuit-breaker';
export * from './metrics';
