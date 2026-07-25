/**
 * AI Provider Interface and Types
 * 
 * Defines the unified interface that all AI providers must implement.
 * This abstracts away provider-specific implementations so the rest
 * of DerList can work with any AI service.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface AIProvider {
  /** Provider identifier (e.g., 'serpapi', 'openai', 'anthropic') */
  readonly id: string;
  
  /** Display name for UI (e.g., 'SerpApi', 'OpenAI GPT-4', 'Claude') */
  readonly name: string;
  
  /** Whether this provider is currently available/configured */
  isAvailable(): Promise<boolean>;

  /**
   * Identify products from text input (shopping lists, descriptions, etc.)
   * Used by: Product Getter, URL importer, manual entry auto-fill
   */
  identifyProduct(input: string, options?: IdentifyProductOptions): Promise<ProductCandidate[]>;

  /**
   * Search for products using natural language queries
   * Used by: AI-powered search, Shopping Assistant product discovery
   */
  searchProducts(query: string, options?: SearchProductsOptions): Promise<ProductSearchResult[]>;

  /**
   * Chat with the AI (conversation, tool calling, shopping assistance)
   * Used by: Shopping Assistant, general AI chat
   */
  chat(messages: AIMessage[], options?: ChatOptions): Promise<ChatResponse>;

  /**
   * Analyze images to identify products
   * Used by: Image-based product identification, screenshot analysis
   */
  analyzeImage(imageUrl: string, options?: AnalyzeImageOptions): Promise<ProductCandidate[]>;

  /**
   * Normalize/enrich product data (clean up titles, find missing info, etc.)
   * Used by: Product data cleanup, merge assistance, quality improvement
   */
  normalizeProduct(productData: RawProductData, options?: NormalizeProductOptions): Promise<NormalizedProduct>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Types (OpenAI-compatible)
// ─────────────────────────────────────────────────────────────────────────────

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: AIToolCall[];
  name?: string; // For tool/function messages
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductCandidate {
  /** Product title/name */
  title: string;
  
  /** Brand/manufacturer */
  brand?: string;
  
  /** Model number/name */
  model?: string;
  
  /** Category (Electronics, Clothing, etc.) */
  category?: string;
  
  /** Estimated price */
  price?: number;
  currency?: string;
  
  /** Product identifiers */
  sku?: string;
  mpn?: string; // Manufacturer Part Number
  gtin?: string; // Global Trade Item Number
  upc?: string;
  asin?: string;
  
  /** Where this product can be found */
  retailer?: string;
  url?: string;
  
  /** Product images */
  images?: string[];
  
  /** AI confidence in this identification (0-100) */
  confidence: number;
  
  /** Additional metadata */
  description?: string;
  specifications?: Record<string, string>;
}

export interface ProductSearchResult extends ProductCandidate {
  /** Search relevance score */
  relevance: number;
  
  /** Why this product matched the search */
  matchReason?: string;
}

export interface RawProductData {
  title?: string;
  brand?: string;
  price?: number;
  currency?: string;
  url?: string;
  images?: string[];
  description?: string;
  specifications?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NormalizedProduct {
  title: string;
  brand?: string;
  model?: string;
  category?: string;
  price?: number;
  currency?: string;
  identifiers: {
    sku?: string;
    mpn?: string;
    gtin?: string;
    upc?: string;
    asin?: string;
  };
  images: string[];
  specifications: Record<string, string>;
  confidence: number;
  changes: {
    field: string;
    old: string;
    new: string;
    reason: string;
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatResponse {
  message: AIMessage;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

// ─────────────────────────────────────────────────────────────────────────────
// Options Types
// ─────────────────────────────────────────────────────────────────────────────

export interface IdentifyProductOptions {
  /** AI model to use */
  model?: string;
  
  /** Maximum number of products to return */
  maxResults?: number;
  
  /** Minimum confidence threshold */
  minConfidence?: number;
  
  /** Context about where this input came from */
  context?: 'url' | 'text' | 'manual' | 'search';
  
  /** User preferences */
  preferences?: {
    preferredRetailers?: string[];
    preferredBrands?: string[];
    priceRange?: { min?: number; max?: number };
  };
}

export interface SearchProductsOptions {
  /** AI model to use */
  model?: string;
  
  /** Maximum results */
  maxResults?: number;
  
  /** Search filters */
  filters?: {
    category?: string;
    brand?: string;
    priceRange?: { min?: number; max?: number };
    retailer?: string;
  };
  
  /** Include products from specific sources */
  sources?: ('database' | 'web' | 'api')[];
}

export interface ChatOptions {
  /** AI model to use */
  model?: string;
  
  /** Available tools for function calling */
  tools?: AITool[];
  
  /** Temperature (creativity) 0.0-1.0 */
  temperature?: number;
  
  /** Maximum tokens in response */
  maxTokens?: number;
  
  /** Enable streaming */
  stream?: boolean;
  
  /** System prompt override */
  systemPrompt?: string;
}

export interface AnalyzeImageOptions {
  /** AI model to use (must support vision) */
  model?: string;
  
  /** What to look for in the image */
  prompt?: string;
  
  /** Maximum products to identify */
  maxResults?: number;
  
  /** Minimum confidence */
  minConfidence?: number;
}

export interface NormalizeProductOptions {
  /** AI model to use */
  model?: string;
  
  /** Fields to focus on normalizing */
  fields?: ('title' | 'brand' | 'category' | 'identifiers' | 'specifications')[];
  
  /** Whether to preserve original data */
  preserveOriginal?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definition Types (for function calling)
// ─────────────────────────────────────────────────────────────────────────────

export interface AITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Configuration Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderConfig {
  /** Provider ID */
  providerId: string;
  
  /** User-specific configuration */
  config: Record<string, unknown>;
  
  /** Whether this provider is enabled for the user */
  enabled: boolean;
  
  /** Default model to use */
  defaultModel?: string;
}

export interface ProviderMetadata {
  id: string;
  name: string;
  description: string;
  homepage?: string;
  pricing?: {
    type: 'free' | 'paid' | 'freemium';
    description: string;
  };
  features: {
    chat: boolean;
    vision: boolean;
    tools: boolean;
    search: boolean;
    identifyProduct: boolean;
    normalizeProduct: boolean;
  };
  models: {
    id: string;
    name: string;
    capabilities: string[];
  }[];
  configSchema: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'select';
      label: string;
      description?: string;
      required?: boolean;
      default?: unknown;
      options?: { value: string; label: string }[];
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

export class AIProviderError extends Error {
  constructor(
    message: string,
    public providerId: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class AIProviderConfigError extends AIProviderError {
  constructor(providerId: string, field: string, message: string) {
    super(`Configuration error for ${field}: ${message}`, providerId, 'CONFIG_ERROR');
    this.name = 'AIProviderConfigError';
  }
}

export class AIProviderUnavailableError extends AIProviderError {
  constructor(providerId: string, reason: string) {
    super(`Provider ${providerId} is unavailable: ${reason}`, providerId, 'UNAVAILABLE');
    this.name = 'AIProviderUnavailableError';
  }
}