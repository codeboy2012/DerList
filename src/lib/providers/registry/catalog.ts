/**
 * Provider Catalog — Static metadata for all supported providers.
 *
 * This is the single source of truth for what providers DerList supports.
 * Adding a new provider to this list makes it available in the Settings UI.
 * The actual implementation is registered separately.
 */

import type { AICapabilities, ProviderCategoryType } from './types';

export interface CatalogEntry {
  id: string;
  name: string;
  category: ProviderCategoryType;
  description: string;
  website: string;
  capabilities?: Partial<AICapabilities>;
  requiredConfig: { key: string; label: string; type: 'text' | 'password'; placeholder?: string }[];
  optionalConfig?: {
    key: string;
    label: string;
    type: 'text' | 'select';
    options?: string[];
    placeholder?: string;
  }[];
  free?: boolean;
  freeTier?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Providers
// ─────────────────────────────────────────────────────────────────────────────

export const AI_PROVIDERS: CatalogEntry[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'ai',
    description:
      'Access 300+ models from all major providers through one API. Free tier available.',
    website: 'https://openrouter.ai',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
      jsonMode: true,
      embeddings: false,
    },
    requiredConfig: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-or-...' },
    ],
    optionalConfig: [
      { key: 'model', label: 'Model', type: 'text', placeholder: 'openrouter/free' },
    ],
    free: true,
    freeTier: 'Free models available (no credits needed)',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'ai',
    description: 'GPT-4o, GPT-4o-mini, and GPT-4 Turbo for chat, vision, and embeddings.',
    website: 'https://platform.openai.com',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
      jsonMode: true,
      embeddings: true,
    },
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' }],
    optionalConfig: [{ key: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' }],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    category: 'ai',
    description: 'Claude 4 Sonnet, Claude 4 Opus for advanced reasoning and large context.',
    website: 'https://www.anthropic.com',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
      jsonMode: true,
      embeddings: false,
    },
    requiredConfig: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-ant-...' },
    ],
    optionalConfig: [
      { key: 'model', label: 'Model', type: 'text', placeholder: 'claude-sonnet-4-20250514' },
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    category: 'ai',
    description: 'Gemini 2.5 Pro and Flash for multimodal AI with long context.',
    website: 'https://ai.google.dev',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
      jsonMode: true,
      embeddings: true,
    },
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'AI...' }],
    optionalConfig: [
      { key: 'model', label: 'Model', type: 'text', placeholder: 'gemini-2.5-flash' },
    ],
    free: true,
    freeTier: 'Free tier with rate limits',
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    category: 'ai',
    description: 'Grok-3 for real-time information and reasoning.',
    website: 'https://x.ai',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
      jsonMode: true,
      embeddings: false,
    },
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'xai-...' }],
    optionalConfig: [{ key: 'model', label: 'Model', type: 'text', placeholder: 'grok-3' }],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    category: 'ai',
    description: 'Mistral Large and Small for efficient European AI.',
    website: 'https://mistral.ai',
    capabilities: {
      chat: true,
      streaming: true,
      vision: false,
      functionCalling: true,
      jsonMode: true,
      embeddings: true,
    },
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
    optionalConfig: [
      { key: 'model', label: 'Model', type: 'text', placeholder: 'mistral-large-latest' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    category: 'ai',
    description: 'DeepSeek V3 and R1 for code and reasoning tasks.',
    website: 'https://deepseek.com',
    capabilities: {
      chat: true,
      streaming: true,
      vision: false,
      functionCalling: true,
      jsonMode: true,
      embeddings: false,
    },
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
    optionalConfig: [{ key: 'model', label: 'Model', type: 'text', placeholder: 'deepseek-chat' }],
  },
  {
    id: 'groq',
    name: 'Groq',
    category: 'ai',
    description: 'Ultra-fast inference on open-source models via custom hardware.',
    website: 'https://groq.com',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
      jsonMode: true,
      embeddings: false,
    },
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'gsk_...' }],
    optionalConfig: [
      { key: 'model', label: 'Model', type: 'text', placeholder: 'llama-3.3-70b-versatile' },
    ],
    free: true,
    freeTier: 'Generous free tier with rate limits',
  },
  {
    id: 'together',
    name: 'Together AI',
    category: 'ai',
    description: 'Open-source models with fast inference and fine-tuning.',
    website: 'https://together.ai',
    capabilities: {
      chat: true,
      streaming: true,
      vision: false,
      functionCalling: true,
      jsonMode: true,
      embeddings: true,
    },
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
    optionalConfig: [
      {
        key: 'model',
        label: 'Model',
        type: 'text',
        placeholder: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      },
    ],
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    category: 'ai',
    description: 'Fastest inference for open-source models.',
    website: 'https://fireworks.ai',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
      jsonMode: true,
      embeddings: true,
    },
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
    optionalConfig: [
      {
        key: 'model',
        label: 'Model',
        type: 'text',
        placeholder: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
      },
    ],
  },
  {
    id: 'cohere',
    name: 'Cohere',
    category: 'ai',
    description: 'Command R+ for enterprise RAG and text generation.',
    website: 'https://cohere.com',
    capabilities: {
      chat: true,
      streaming: true,
      vision: false,
      functionCalling: true,
      jsonMode: false,
      embeddings: true,
    },
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
    optionalConfig: [{ key: 'model', label: 'Model', type: 'text', placeholder: 'command-r-plus' }],
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    category: 'ai',
    description: 'AI with real-time web search and citations.',
    website: 'https://perplexity.ai',
    capabilities: {
      chat: true,
      streaming: true,
      vision: false,
      functionCalling: false,
      jsonMode: false,
      embeddings: false,
    },
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
    optionalConfig: [{ key: 'model', label: 'Model', type: 'text', placeholder: 'sonar-pro' }],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Search Providers
// ─────────────────────────────────────────────────────────────────────────────

export const SEARCH_PROVIDERS: CatalogEntry[] = [
  {
    id: 'serpapi',
    name: 'SerpAPI',
    category: 'search',
    description: 'Google Shopping search for product discovery.',
    website: 'https://serpapi.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'amazon',
    name: 'Amazon PA-API',
    category: 'search',
    description: 'Official Amazon Product Advertising API.',
    website: 'https://affiliate-program.amazon.com',
    requiredConfig: [
      { key: 'accessKey', label: 'Access Key', type: 'password' },
      { key: 'secretKey', label: 'Secret Key', type: 'password' },
      { key: 'partnerTag', label: 'Partner Tag', type: 'text' },
    ],
  },
  {
    id: 'walmart',
    name: 'Walmart',
    category: 'search',
    description: 'Walmart product search and pricing.',
    website: 'https://developer.walmart.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'bestbuy',
    name: 'Best Buy',
    category: 'search',
    description: 'Best Buy product catalog API.',
    website: 'https://bestbuyapis.github.io/api-reference',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'ebay',
    name: 'eBay',
    category: 'search',
    description: 'eBay product and listing search.',
    website: 'https://developer.ebay.com',
    requiredConfig: [{ key: 'appId', label: 'App ID', type: 'password' }],
  },
  {
    id: 'newegg',
    name: 'Newegg',
    category: 'search',
    description: 'Newegg product catalog for electronics.',
    website: 'https://newegg.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'target',
    name: 'Target',
    category: 'search',
    description: 'Target product search and inventory.',
    website: 'https://target.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Price Providers
// ─────────────────────────────────────────────────────────────────────────────

export const PRICE_PROVIDERS: CatalogEntry[] = [
  {
    id: 'keepa',
    name: 'Keepa',
    category: 'price',
    description: 'Amazon price history and tracking.',
    website: 'https://keepa.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'priceapi',
    name: 'PriceAPI',
    category: 'price',
    description: 'Multi-retailer price monitoring.',
    website: 'https://priceapi.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'google-shopping',
    name: 'Google Shopping',
    category: 'price',
    description: 'Google Shopping price comparison.',
    website: 'https://shopping.google.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// All providers
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_PROVIDERS = [...AI_PROVIDERS, ...SEARCH_PROVIDERS, ...PRICE_PROVIDERS];

/**
 * Get catalog entry by ID.
 */
export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return ALL_PROVIDERS.find((p) => p.id === id);
}
