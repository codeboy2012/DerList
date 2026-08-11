/**
 * Provider Catalog — Static metadata for all supported providers.
 *
 * This is the single source of truth for what providers DerList supports.
 * Adding a new provider: add an entry here → it appears in Settings UI.
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
    type: 'text' | 'select' | 'password';
    options?: string[];
    placeholder?: string;
  }[];
  free?: boolean;
  freeTier?: string;
}

// ─── AI Providers (17) ───

export const AI_PROVIDERS: CatalogEntry[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'ai',
    description: 'Access 300+ models through one API. Free tier available.',
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
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        placeholder: 'https://openrouter.ai/api/v1',
      },
    ],
    free: true,
    freeTier: 'Free models (no credits needed)',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'ai',
    description: 'GPT-4o, o1, and embeddings.',
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
    optionalConfig: [
      { key: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
      { key: 'baseUrl', label: 'Base URL', type: 'text' },
      { key: 'organization', label: 'Org ID', type: 'text' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    category: 'ai',
    description: 'Claude 4 Sonnet & Opus.',
    website: 'https://anthropic.com',
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
    description: 'Gemini 2.5 Pro/Flash multimodal via Google AI Studio.',
    website: 'https://ai.google.dev',
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
      { key: 'model', label: 'Model', type: 'text', placeholder: 'gemini-2.5-flash' },
    ],
    free: true,
    freeTier: 'Free tier with rate limits',
  },
  {
    id: 'google-vertex',
    name: 'Google Vertex AI',
    category: 'ai',
    description: 'Google Cloud Vertex AI for Gemini and other supported Google AI models.',
    website: 'https://cloud.google.com/vertex-ai',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
      jsonMode: true,
      embeddings: true,
    },
    requiredConfig: [
      { key: 'projectId', label: 'Google Cloud Project ID', type: 'text', placeholder: 'my-project-id' },
      { key: 'region', label: 'Region', type: 'text', placeholder: 'us-central1' },
    ],
    optionalConfig: [
      { key: 'apiKey', label: 'API Key (if supported)', type: 'password', placeholder: 'AIza...' },
      { key: 'serviceAccountJson', label: 'Service Account JSON (alternative auth)', type: 'password', placeholder: '{"type":"service_account",...}' },
      { key: 'model', label: 'Model', type: 'text', placeholder: 'gemini-2.5-flash' },
    ],
  },
  {
    id: 'google-vertex-derlist',
    name: 'Google Vertex AI – DerList',
    category: 'ai',
    description: 'DerList Shopping AI powered by Google Vertex AI. Includes optimized shopping research system prompt.',
    website: 'https://cloud.google.com/vertex-ai',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
      jsonMode: true,
      embeddings: false,
    },
    requiredConfig: [
      { key: 'projectId', label: 'Google Cloud Project ID', type: 'text', placeholder: 'my-project-id' },
      { key: 'region', label: 'Region', type: 'text', placeholder: 'us-central1' },
    ],
    optionalConfig: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'AIza...' },
      { key: 'serviceAccountJson', label: 'Service Account JSON', type: 'password', placeholder: '{"type":"service_account",...}' },
      { key: 'model', label: 'Model', type: 'text', placeholder: 'gemini-2.5-flash' },
    ],
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    category: 'ai',
    description: 'Grok-3 real-time reasoning.',
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
    description: 'Mistral Large/Small European AI.',
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
    description: 'DeepSeek V3/R1 code & reasoning.',
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
    optionalConfig: [
      { key: 'model', label: 'Model', type: 'text', placeholder: 'deepseek-chat' },
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        placeholder: 'https://api.deepseek.com/v1',
      },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    category: 'ai',
    description: 'Ultra-fast LPU inference.',
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
    freeTier: 'Generous free tier',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    category: 'ai',
    description: 'Fastest inference via wafer-scale.',
    website: 'https://cerebras.ai',
    capabilities: {
      chat: true,
      streaming: true,
      vision: false,
      functionCalling: false,
      jsonMode: true,
      embeddings: false,
    },
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
    optionalConfig: [{ key: 'model', label: 'Model', type: 'text', placeholder: 'llama-3.3-70b' }],
    free: true,
    freeTier: 'Free tier available',
  },
  {
    id: 'together',
    name: 'Together AI',
    category: 'ai',
    description: 'Fast open-source model inference.',
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
    description: 'Fastest open-source inference.',
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
    optionalConfig: [{ key: 'model', label: 'Model', type: 'text' }],
  },
  {
    id: 'cohere',
    name: 'Cohere',
    category: 'ai',
    description: 'Command R+ enterprise RAG.',
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
    description: 'AI with real-time web search.',
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
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    category: 'ai',
    description: 'Run models locally. No API key.',
    website: 'https://ollama.ai',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: false,
      jsonMode: true,
      embeddings: true,
    },
    requiredConfig: [],
    optionalConfig: [
      { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'http://localhost:11434/v1' },
      { key: 'model', label: 'Model', type: 'text', placeholder: 'llama3.3' },
    ],
    free: true,
    freeTier: 'Free (runs locally)',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    category: 'ai',
    description: 'Local OpenAI-compatible server.',
    website: 'https://lmstudio.ai',
    capabilities: {
      chat: true,
      streaming: true,
      vision: false,
      functionCalling: false,
      jsonMode: true,
      embeddings: true,
    },
    requiredConfig: [],
    optionalConfig: [
      { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'http://localhost:1234/v1' },
      { key: 'model', label: 'Model', type: 'text' },
    ],
    free: true,
    freeTier: 'Free (runs locally)',
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    category: 'ai',
    description: 'OpenAI on Azure enterprise.',
    website: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
      jsonMode: true,
      embeddings: true,
    },
    requiredConfig: [
      { key: 'apiKey', label: 'API Key', type: 'password' },
      {
        key: 'baseUrl',
        label: 'Endpoint',
        type: 'text',
        placeholder: 'https://your-resource.openai.azure.com',
      },
    ],
    optionalConfig: [{ key: 'model', label: 'Deployment', type: 'text', placeholder: 'gpt-4o' }],
  },
  {
    id: 'aws-bedrock',
    name: 'AWS Bedrock',
    category: 'ai',
    description: 'Managed models on AWS.',
    website: 'https://aws.amazon.com/bedrock',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
      jsonMode: true,
      embeddings: true,
    },
    requiredConfig: [
      { key: 'accessKey', label: 'Access Key', type: 'password' },
      { key: 'secretKey', label: 'Secret Key', type: 'password' },
      { key: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1' },
    ],
    optionalConfig: [{ key: 'model', label: 'Model ID', type: 'text' }],
  },
];

// ─── Product Search Providers (22) ───

export const SEARCH_PROVIDERS: CatalogEntry[] = [
  {
    id: 'brave',
    name: 'Brave Search',
    category: 'search',
    description: 'Web, image, news, and video search with rich results and LLM context.',
    website: 'https://brave.com/search/api',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'BSA...' }],
    optionalConfig: [
      { key: 'maxResults', label: 'Max Results', type: 'text', placeholder: '8' },
      { key: 'enableImages', label: 'Enable Images', type: 'text', placeholder: 'true' },
    ],
    free: true,
    freeTier: '2,000 queries/month free',
  },
  {
    id: 'serpapi',
    name: 'SerpAPI',
    category: 'search',
    description: 'Google Shopping search.',
    website: 'https://serpapi.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'amazon-paapi',
    name: 'Amazon PA-API',
    category: 'search',
    description: 'Official Amazon Product API.',
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
    description: 'Walmart product catalog.',
    website: 'https://developer.walmart.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'bestbuy',
    name: 'Best Buy',
    category: 'search',
    description: 'Best Buy product API.',
    website: 'https://bestbuyapis.github.io/api-reference',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'ebay',
    name: 'eBay',
    category: 'search',
    description: 'eBay Browse & Finding API.',
    website: 'https://developer.ebay.com',
    requiredConfig: [{ key: 'appId', label: 'App ID', type: 'password' }],
  },
  {
    id: 'newegg',
    name: 'Newegg',
    category: 'search',
    description: 'Newegg electronics catalog.',
    website: 'https://newegg.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'target',
    name: 'Target',
    category: 'search',
    description: 'Target product search.',
    website: 'https://target.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'microcenter',
    name: 'Micro Center',
    category: 'search',
    description: 'PC components specialist.',
    website: 'https://microcenter.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'bhphoto',
    name: 'B&H Photo',
    category: 'search',
    description: 'Camera, electronics, pro gear.',
    website: 'https://bhphotovideo.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'costco',
    name: 'Costco',
    category: 'search',
    description: 'Costco wholesale products.',
    website: 'https://costco.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'homedepot',
    name: 'Home Depot',
    category: 'search',
    description: 'Home improvement products.',
    website: 'https://homedepot.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'lowes',
    name: "Lowe's",
    category: 'search',
    description: 'Home improvement retailer.',
    website: 'https://lowes.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'etsy',
    name: 'Etsy',
    category: 'search',
    description: 'Handmade & vintage marketplace.',
    website: 'https://developer.etsy.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'aliexpress',
    name: 'AliExpress',
    category: 'search',
    description: 'Chinese marketplace products.',
    website: 'https://aliexpress.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'google-shopping',
    name: 'Google Shopping',
    category: 'search',
    description: 'Google product search & comparison.',
    website: 'https://shopping.google.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'bing-shopping',
    name: 'Bing Shopping',
    category: 'search',
    description: 'Microsoft Bing product search.',
    website: 'https://bing.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'datafor-seo',
    name: 'DataForSEO',
    category: 'search',
    description: 'Shopping SERP data API.',
    website: 'https://dataforseo.com',
    requiredConfig: [
      { key: 'login', label: 'Login', type: 'text' },
      { key: 'password', label: 'Password', type: 'password' },
    ],
  },
  {
    id: 'rainforest',
    name: 'Rainforest API',
    category: 'search',
    description: 'Amazon product data at scale.',
    website: 'https://rainforestapi.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'dell',
    name: 'Dell',
    category: 'search',
    description: 'Dell computers & peripherals.',
    website: 'https://dell.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'apple',
    name: 'Apple',
    category: 'search',
    description: 'Apple products & accessories.',
    website: 'https://apple.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'nike',
    name: 'Nike',
    category: 'search',
    description: 'Nike footwear & apparel.',
    website: 'https://nike.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'rei',
    name: 'REI',
    category: 'search',
    description: 'Outdoor gear & equipment.',
    website: 'https://rei.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'tavily',
    name: 'Tavily',
    category: 'search',
    description: 'AI-optimized search built for LLM agents.',
    website: 'https://tavily.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
    free: true,
    freeTier: '1,000 searches/month free',
  },
  {
    id: 'exa',
    name: 'Exa',
    category: 'search',
    description: 'Neural search engine for finding similar content.',
    website: 'https://exa.ai',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    category: 'search',
    description: 'Web scraping and crawling API for AI.',
    website: 'https://firecrawl.dev',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
    free: true,
    freeTier: '500 pages/month free',
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    category: 'search',
    description: 'Privacy-focused search (no API key needed).',
    website: 'https://duckduckgo.com',
    requiredConfig: [],
    free: true,
    freeTier: 'Free (no API key)',
  },
  {
    id: 'custom-search',
    name: 'Custom Search API',
    category: 'search',
    description: 'Connect any search API with a custom endpoint.',
    website: '',
    requiredConfig: [{ key: 'baseUrl', label: 'Endpoint URL', type: 'text' }],
    optionalConfig: [
      { key: 'apiKey', label: 'API Key', type: 'text' },
      { key: 'headers', label: 'Custom Headers (JSON)', type: 'text' },
    ],
  },
];

// ─── Price Tracking Providers (13) ───

export const PRICE_PROVIDERS: CatalogEntry[] = [
  {
    id: 'keepa',
    name: 'Keepa',
    category: 'price',
    description: 'Amazon price history & tracking.',
    website: 'https://keepa.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'camelcamelcamel',
    name: 'CamelCamelCamel',
    category: 'price',
    description: 'Amazon price alerts & history.',
    website: 'https://camelcamelcamel.com',
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
    id: 'google-shopping-price',
    name: 'Google Shopping',
    category: 'price',
    description: 'Google price comparison.',
    website: 'https://shopping.google.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'prisync',
    name: 'Prisync',
    category: 'price',
    description: 'Competitor price tracking.',
    website: 'https://prisync.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'pricerunner',
    name: 'PriceRunner',
    category: 'price',
    description: 'European price comparison.',
    website: 'https://pricerunner.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'idealo',
    name: 'Idealo',
    category: 'price',
    description: 'German price comparison.',
    website: 'https://idealo.de',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'slickdeals',
    name: 'Slickdeals',
    category: 'price',
    description: 'Community deal aggregator.',
    website: 'https://slickdeals.net',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'honey',
    name: 'Honey/PayPal',
    category: 'price',
    description: 'Coupon & deal detection.',
    website: 'https://joinhoney.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'rakuten',
    name: 'Rakuten',
    category: 'price',
    description: 'Cashback & price tracking.',
    website: 'https://rakuten.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'dealnews',
    name: 'DealNews',
    category: 'price',
    description: 'Curated deal aggregation.',
    website: 'https://dealnews.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'retailmenot',
    name: 'RetailMeNot',
    category: 'price',
    description: 'Coupon codes & deals.',
    website: 'https://retailmenot.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'dataweave',
    name: 'DataWeave',
    category: 'price',
    description: 'Enterprise price intelligence.',
    website: 'https://dataweave.com',
    requiredConfig: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
];

// ─── All Providers ───

export const ALL_PROVIDERS = [...AI_PROVIDERS, ...SEARCH_PROVIDERS, ...PRICE_PROVIDERS];

/** Get catalog entry by ID. */
export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return ALL_PROVIDERS.find((p) => p.id === id);
}

/** Get all providers by category. */
export function getCatalogByCategory(category: ProviderCategoryType): CatalogEntry[] {
  return ALL_PROVIDERS.filter((p) => p.category === category);
}

/** Summary counts for dashboard display. */
export const PROVIDER_COUNTS = {
  ai: AI_PROVIDERS.length,
  search: SEARCH_PROVIDERS.length,
  price: PRICE_PROVIDERS.length,
  total: ALL_PROVIDERS.length,
};
