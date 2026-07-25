/**
 * AI Provider Registry
 * 
 * Central system for registering, discovering, and instantiating AI providers.
 * Handles provider lifecycle, configuration, and user preferences.
 */

import { AIProvider, ProviderConfig, ProviderMetadata, AIProviderUnavailableError } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Provider Registry
// ─────────────────────────────────────────────────────────────────────────────

class AIProviderRegistry {
  private providers = new Map<string, AIProviderConstructor>();
  private instances = new Map<string, AIProvider>();
  private metadata = new Map<string, ProviderMetadata>();

  /**
   * Register a provider class
   */
  register(
    providerId: string, 
    ProviderClass: AIProviderConstructor,
    metadata: ProviderMetadata
  ): void {
    this.providers.set(providerId, ProviderClass);
    this.metadata.set(providerId, metadata);
  }

  /**
   * Get all registered provider metadata
   */
  getAvailableProviders(): ProviderMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Get metadata for a specific provider
   */
  getProviderMetadata(providerId: string): ProviderMetadata | undefined {
    return this.metadata.get(providerId);
  }

  /**
   * Create a provider instance with configuration
   */
  async createProvider(providerId: string, config: Record<string, unknown>): Promise<AIProvider> {
    const ProviderClass = this.providers.get(providerId);
    if (!ProviderClass) {
      throw new AIProviderUnavailableError(providerId, 'Provider not registered');
    }

    const instance = new ProviderClass(config);
    
    // Test availability
    const available = await instance.isAvailable();
    if (!available) {
      throw new AIProviderUnavailableError(providerId, 'Provider failed availability check');
    }

    return instance;
  }

  /**
   * Get or create a cached provider instance
   */
  async getInstance(providerId: string, config: Record<string, unknown>): Promise<AIProvider> {
    const cacheKey = `${providerId}:${JSON.stringify(config)}`;
    
    if (this.instances.has(cacheKey)) {
      const instance = this.instances.get(cacheKey)!;
      
      // Verify it's still available
      if (await instance.isAvailable()) {
        return instance;
      } else {
        this.instances.delete(cacheKey);
      }
    }

    const instance = await this.createProvider(providerId, config);
    this.instances.set(cacheKey, instance);
    return instance;
  }

  /**
   * Clear cached instances (useful when config changes)
   */
  clearCache(providerId?: string): void {
    if (providerId) {
      // Clear only instances for this provider
      for (const [key] of this.instances) {
        if (key.startsWith(`${providerId}:`)) {
          this.instances.delete(key);
        }
      }
    } else {
      // Clear all instances
      this.instances.clear();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a provider instance for a user
 */
export async function getAIProvider(
  userId: string,
  fallbackProviderId?: string
): Promise<AIProvider> {
  const userConfig = await getUserAIConfig(userId);
  
  // Try user's preferred provider first
  if (userConfig?.providerId && userConfig?.config) {
    try {
      return await registry.getInstance(userConfig.providerId, userConfig.config);
    } catch (error) {
      console.warn(`Failed to load user's preferred provider ${userConfig.providerId}:`, error);
      // Fall through to fallback
    }
  }
  
  // Try fallback provider
  if (fallbackProviderId) {
    const fallbackMetadata = registry.getProviderMetadata(fallbackProviderId);
    if (fallbackMetadata) {
      try {
        const defaultConfig = getDefaultConfig(fallbackMetadata);
        return await registry.getInstance(fallbackProviderId, defaultConfig);
      } catch (error) {
        console.warn(`Failed to load fallback provider ${fallbackProviderId}:`, error);
      }
    }
  }
  
  // Try to find any available provider
  const availableProviders = registry.getAvailableProviders();
  for (const metadata of availableProviders) {
    try {
      const defaultConfig = getDefaultConfig(metadata);
      return await registry.getInstance(metadata.id, defaultConfig);
    } catch (error) {
      // Continue to next provider
      continue;
    }
  }
  
  throw new AIProviderUnavailableError('none', 'No AI providers are available');
}

/**
 * Get the recommended provider for new users
 */
export async function getRecommendedProvider(): Promise<AIProvider> {
  // Try SerpApi first (recommended in roadmap)
  try {
    return await getAIProvider('', 'serpapi');
  } catch (error) {
    // Fall back to any available provider
    return await getAIProvider('');
  }
}

/**
 * Test if a specific provider is available with given config
 */
export async function testProviderConfig(
  providerId: string, 
  config: Record<string, unknown>
): Promise<{ available: boolean; error?: string }> {
  try {
    const provider = await registry.createProvider(providerId, config);
    const available = await provider.isAvailable();
    return { available };
  } catch (error) {
    return { 
      available: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function getDefaultConfig(metadata: ProviderMetadata): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  
  for (const [key, schema] of Object.entries(metadata.configSchema)) {
    if (schema.default !== undefined) {
      config[key] = schema.default;
    }
  }
  
  return config;
}

async function getUserAIConfig(userId: string): Promise<ProviderConfig | null> {
  if (!userId) return null;
  
  try {
    // Import prisma dynamically to avoid circular dependencies
    const { prisma } = await import('@/lib/prisma');
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        aiProviderId: true,
        aiProviderConfig: true,
      },
    });
    
    if (!user?.aiProviderId) return null;
    
    return {
      providerId: user.aiProviderId,
      config: (user.aiProviderConfig as Record<string, unknown>) ?? {},
      enabled: true,
    };
  } catch (error) {
    console.error('Failed to load user AI config:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types and Exports
// ─────────────────────────────────────────────────────────────────────────────

interface AIProviderConstructor {
  new (config: Record<string, unknown>): AIProvider;
}

// Global registry instance
export const registry = new AIProviderRegistry();

// Re-export types for convenience
export type { AIProvider, ProviderConfig, ProviderMetadata } from './types';