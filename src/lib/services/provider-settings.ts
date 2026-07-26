/**
 * Provider Settings Service
 *
 * Business logic for managing provider configurations.
 * Handles CRUD, validation, and testing of provider configs.
 */

import type { ProviderCategory } from '@prisma/client';
import { ProviderManager } from '@/lib/providers';
import {
  ProviderRepository,
  type ProviderConfig,
  type ProviderConfigCreateInput,
  type ProviderConfigUpdateInput,
} from '@/lib/repositories';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderInfo {
  id: string;
  name: string;
  category: 'AI' | 'SHOPPING_SEARCH' | 'PRICE';
  description: string;
  requiredFields: {
    name: string;
    label: string;
    type: 'text' | 'password';
    placeholder?: string;
  }[];
  optionalFields?: { name: string; label: string; type: 'text' | 'select'; options?: string[] }[];
}

export interface TestResult {
  success: boolean;
  message: string;
  latency?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Available Providers (static registry)
// ─────────────────────────────────────────────────────────────────────────────

export const AVAILABLE_PROVIDERS: ProviderInfo[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'AI',
    description: 'Access to 100+ AI models including GPT-4, Claude, Llama. Free tier available.',
    requiredFields: [
      { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-or-...' },
    ],
    optionalFields: [
      {
        name: 'model',
        label: 'Default Model',
        type: 'select',
        options: [
          'meta-llama/llama-3.1-8b-instruct:free',
          'google/gemma-2-9b-it:free',
          'openai/gpt-4o-mini',
          'openai/gpt-4o',
          'anthropic/claude-3.5-sonnet',
        ],
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'AI',
    description: 'GPT-4o, GPT-4o-mini for chat and product identification.',
    requiredFields: [{ name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' }],
    optionalFields: [
      {
        name: 'model',
        label: 'Default Model',
        type: 'select',
        options: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
      },
    ],
  },
  {
    id: 'serpapi',
    name: 'SerpAPI',
    category: 'SHOPPING_SEARCH',
    description: 'Google Shopping search for product discovery and price comparison.',
    requiredFields: [
      { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Your SerpAPI key' },
    ],
    optionalFields: [
      {
        name: 'engine',
        label: 'Search Engine',
        type: 'select',
        options: ['google_shopping', 'walmart', 'ebay'],
      },
    ],
  },
  {
    id: 'keepa',
    name: 'Keepa',
    category: 'PRICE',
    description: 'Amazon price history and price drop alerts.',
    requiredFields: [
      { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Your Keepa API key' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class ProviderSettingsService {
  constructor(private readonly providers: ProviderManager) {}

  /**
   * Get all configured providers for a user.
   */
  async getUserProviders(userId: string): Promise<ProviderConfig[]> {
    return ProviderRepository.listAll(userId);
  }

  /**
   * Get configured providers for a specific category.
   */
  async getUserProvidersByCategory(
    userId: string,
    category: ProviderCategory
  ): Promise<ProviderConfig[]> {
    return ProviderRepository.listByCategory(userId, category);
  }

  /**
   * Get the list of all available providers (static data).
   */
  getAvailableProviders(category?: string): ProviderInfo[] {
    if (category) {
      return AVAILABLE_PROVIDERS.filter((p) => p.category === category);
    }
    return AVAILABLE_PROVIDERS;
  }

  /**
   * Add a new provider configuration.
   */
  async addProvider(input: ProviderConfigCreateInput): Promise<ProviderConfig> {
    // Validate that the provider ID is known
    const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === input.providerId);
    if (!providerInfo) {
      throw new Error(`Unknown provider: ${input.providerId}`);
    }

    // Validate required fields
    for (const field of providerInfo.requiredFields) {
      if (!input.config[field.name]) {
        throw new Error(`${field.label} is required.`);
      }
    }

    return ProviderRepository.create(input);
  }

  /**
   * Update a provider configuration.
   */
  async updateProvider(
    id: string,
    userId: string,
    input: ProviderConfigUpdateInput
  ): Promise<ProviderConfig> {
    return ProviderRepository.update(id, userId, input);
  }

  /**
   * Delete a provider configuration.
   */
  async deleteProvider(id: string, userId: string): Promise<void> {
    await ProviderRepository.delete(id, userId);
  }

  /**
   * Test a provider configuration by making a lightweight request.
   */
  async testProvider(id: string, userId: string): Promise<TestResult> {
    const config = await ProviderRepository.findById(id, userId);
    if (!config) {
      return { success: false, message: 'Provider not found.' };
    }

    const start = Date.now();

    try {
      switch (config.category) {
        case 'AI': {
          const provider = await this.providers.getAIProvider(userId);
          if (!provider) {
            return { success: false, message: 'Could not instantiate AI provider.' };
          }
          await provider.chat([{ role: 'user', content: 'Hello' }], {
            maxTokens: 5,
            temperature: 0,
          });
          break;
        }
        case 'SHOPPING_SEARCH': {
          const provider = await this.providers.getSearchProvider(userId);
          if (!provider) {
            return { success: false, message: 'Could not instantiate search provider.' };
          }
          await provider.search('test', { maxResults: 1 });
          break;
        }
        case 'PRICE': {
          // Price providers need a real ASIN to test — just verify config is valid
          const provider = await this.providers.getPriceProvider(userId);
          if (!provider || !provider.isAvailable()) {
            return { success: false, message: 'Provider not available.' };
          }
          break;
        }
      }

      const latency = Date.now() - start;
      await ProviderRepository.updateHealth(id, true);

      return { success: true, message: 'Provider is working correctly.', latency };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Test failed.';
      await ProviderRepository.updateHealth(id, false, message);

      return { success: false, message };
    }
  }

  /**
   * Get a summary of provider status for the user.
   */
  async getProviderSummary(userId: string) {
    const configs = await ProviderRepository.listAll(userId);

    const hasAI = configs.some((c) => c.category === 'AI' && c.enabled);
    const hasSearch = configs.some((c) => c.category === 'SHOPPING_SEARCH' && c.enabled);
    const hasPrice = configs.some((c) => c.category === 'PRICE' && c.enabled);

    return {
      totalConfigured: configs.length,
      hasAI,
      hasSearch,
      hasPrice,
      configs: configs.map((c) => ({
        id: c.id,
        providerId: c.providerId,
        name: c.name,
        category: c.category,
        enabled: c.enabled,
        priority: c.priority,
        isDefault: c.isDefault,
      })),
    };
  }
}
