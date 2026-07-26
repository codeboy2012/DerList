/**
 * Provider Types
 *
 * Clean interfaces for all external provider integrations.
 * Providers answer requests. They know nothing about wishlists or products.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Common
// ─────────────────────────────────────────────────────────────────────────────

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Provider
// ─────────────────────────────────────────────────────────────────────────────

export interface AIProvider {
  readonly id: string;
  readonly name: string;

  /**
   * Send messages and get a completion.
   */
  chat(messages: Message[], options?: AIOptions): Promise<AIResponse>;

  /**
   * Check if this provider is configured and reachable.
   */
  isAvailable(): boolean;
}

export interface AIOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** If true, request JSON output */
  json?: boolean;
}

export interface AIResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  finishReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Provider
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchProvider {
  readonly id: string;
  readonly name: string;

  /**
   * Search for products by query string.
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Check if this provider is configured and reachable.
   */
  isAvailable(): boolean;
}

export interface SearchOptions {
  maxResults?: number;
  /** Country/region code (e.g., 'us', 'uk') */
  region?: string;
  /** Price range filter */
  minPrice?: number;
  maxPrice?: number;
  /** Sort order */
  sort?: 'relevance' | 'price_low' | 'price_high' | 'rating';
}

export interface SearchResult {
  title: string;
  url: string;
  price: number | null;
  currency: string;
  image: string | null;
  retailer: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** Brief description or snippet */
  snippet: string | null;
  /** Whether the item is in stock */
  inStock: boolean | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Price Provider
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceProvider {
  readonly id: string;
  readonly name: string;

  /**
   * Get the current price for a product.
   */
  getCurrentPrice(productId: string, idType: PriceIdType): Promise<PriceResult | null>;

  /**
   * Get price history for a product.
   */
  getPriceHistory(productId: string, idType: PriceIdType, days?: number): Promise<PricePoint[]>;

  /**
   * Check if this provider is configured and reachable.
   */
  isAvailable(): boolean;
}

export type PriceIdType = 'asin' | 'upc' | 'ean' | 'url';

export interface PriceResult {
  currentPrice: number;
  currency: string;
  retailer: string;
  url?: string;
  inStock: boolean;
  lastUpdated: Date;
}

export interface PricePoint {
  price: number;
  currency: string;
  date: Date;
  retailer?: string;
}
