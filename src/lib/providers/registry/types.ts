/**
 * Provider Registry — Core type definitions.
 *
 * These interfaces define the contracts that ALL providers must implement.
 * Adding a new provider requires implementing the relevant interface and
 * registering it in the registry. No other code changes needed.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Provider Categories
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderCategoryType = 'ai' | 'search' | 'price' | 'shipping' | 'reviews' | 'inventory';

// ─────────────────────────────────────────────────────────────────────────────
// Base Provider Interface (all providers implement this)
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseProvider {
  /** Unique provider ID (e.g., 'openai', 'amazon', 'keepa') */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Provider category */
  readonly category: ProviderCategoryType;
  /** Whether this provider is currently configured and ready */
  isAvailable(): boolean;
  /** Health check — verifies connectivity */
  healthCheck?(): Promise<HealthCheckResult>;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface AIProviderInterface extends BaseProvider {
  category: 'ai';
  /** Supported capabilities */
  capabilities: AICapabilities;
  /** Generate a chat completion */
  generate(messages: ChatMessage[], options?: GenerateOptions): Promise<GenerateResult>;
  /** Stream a chat completion (returns async iterator) */
  stream?(messages: ChatMessage[], options?: GenerateOptions): AsyncIterable<StreamChunk>;
  /** Generate embeddings */
  embed?(texts: string[], options?: EmbedOptions): Promise<EmbedResult>;
  /** Vision: analyze an image */
  vision?(imageUrl: string, prompt: string, options?: GenerateOptions): Promise<GenerateResult>;
}

export interface AICapabilities {
  chat: boolean;
  streaming: boolean;
  vision: boolean;
  functionCalling: boolean;
  jsonMode: boolean;
  embeddings: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  json?: boolean;
  tools?: ToolDefinition[];
  timeout?: number;
}

export interface ToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface GenerateResult {
  content: string;
  model: string;
  tokensUsed?: number;
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: string;
  toolCalls?: ToolCall[];
  latencyMs?: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  model?: string;
}

export interface EmbedOptions {
  model?: string;
  dimensions?: number;
}

export interface EmbedResult {
  embeddings: number[][];
  model: string;
  tokensUsed?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Search Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchProviderInterface extends BaseProvider {
  category: 'search';
  /** Search for products */
  searchProducts(query: string, options?: ProductSearchOptions): Promise<ProductSearchResult[]>;
  /** Get product details by ID/URL */
  getProduct?(id: string): Promise<ProductDetails | null>;
}

export interface ProductSearchOptions {
  maxResults?: number;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
  inStockOnly?: boolean;
}

export interface ProductSearchResult {
  title: string;
  brand: string | null;
  price: number | null;
  salePrice: number | null;
  currency: string;
  availability: string | null;
  rating: number | null;
  reviewCount: number | null;
  images: string[];
  description: string | null;
  url: string;
  seller: string;
  shipping: { free: boolean; cost?: number; estimated?: string } | null;
  specifications: Record<string, string>;
  identifiers: { sku?: string; upc?: string; asin?: string; mpn?: string };
}

export interface ProductDetails extends ProductSearchResult {
  fullDescription: string | null;
  gallery: string[];
  breadcrumbs: string[];
  variants: { name: string; options: string[] }[];
  relatedProducts: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Price Tracking Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceProviderInterface extends BaseProvider {
  category: 'price';
  /** Get current price */
  getCurrentPrice(productId: string, idType: PriceIdType): Promise<PriceSnapshot | null>;
  /** Get price history */
  getPriceHistory(productId: string, idType: PriceIdType, days?: number): Promise<PricePoint[]>;
  /** Get price statistics */
  getPriceStats?(productId: string, idType: PriceIdType): Promise<PriceStats | null>;
}

export type PriceIdType = 'asin' | 'upc' | 'ean' | 'url' | 'sku';

export interface PriceSnapshot {
  price: number;
  currency: string;
  retailer: string;
  url?: string;
  inStock: boolean;
  lastUpdated: Date;
  salePrice?: number;
  coupon?: string;
}

export interface PricePoint {
  price: number;
  currency: string;
  date: Date;
  retailer?: string;
}

export interface PriceStats {
  current: number;
  lowest: number;
  highest: number;
  average: number;
  lowestDate: Date;
  highestDate: Date;
  volatility: number;
  trend: 'rising' | 'falling' | 'stable';
  prediction?: { direction: 'up' | 'down' | 'stable'; confidence: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shipping Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ShippingProviderInterface extends BaseProvider {
  category: 'shipping';
  /** Get shipping rates */
  getRates(origin: Address, destination: Address, packages: ShipPackage[]): Promise<ShippingRate[]>;
  /** Track a shipment */
  track?(trackingNumber: string, carrier?: string): Promise<TrackingInfo | null>;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip: string;
  country: string;
}

export interface ShipPackage {
  weight: number;
  weightUnit: 'oz' | 'lb' | 'g' | 'kg';
  dimensions?: { length: number; width: number; height: number; unit: 'in' | 'cm' };
}

export interface ShippingRate {
  carrier: string;
  service: string;
  price: number;
  currency: string;
  estimatedDays: number;
  guaranteed: boolean;
}

export interface TrackingInfo {
  status: 'pre_transit' | 'in_transit' | 'delivered' | 'exception' | 'unknown';
  estimatedDelivery: Date | null;
  events: { date: Date; description: string; location?: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Review Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewProviderInterface extends BaseProvider {
  category: 'reviews';
  /** Get reviews for a product */
  getReviews(productId: string, options?: ReviewOptions): Promise<ReviewResult>;
}

export interface ReviewOptions {
  maxResults?: number;
  sort?: 'recent' | 'helpful' | 'rating_high' | 'rating_low';
  minRating?: number;
}

export interface ReviewResult {
  averageRating: number;
  totalReviews: number;
  reviews: Review[];
  sentiment?: { positive: number; neutral: number; negative: number };
  summary?: string;
}

export interface Review {
  author: string;
  rating: number;
  title: string | null;
  body: string;
  date: Date;
  verified: boolean;
  helpful: number;
  source: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Metrics
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderMetrics {
  providerId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  lastRequestAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  circuitState: 'closed' | 'open' | 'half-open';
}
