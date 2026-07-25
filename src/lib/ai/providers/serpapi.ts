/**
 * SerpApi Provider Implementation
 * 
 * Uses SerpApi for product search and discovery. Recommended as the free tier
 * provider for new users. Supports Google Shopping, Images, Search, and Organic results.
 * 
 * Note: SerpApi is primarily a search engine, not a conversational AI.
 * For chat/conversation features, it will need to be paired with another provider
 * or use a simple rule-based system.
 */

import {
  AIProvider,
  ProductCandidate,
  ProductSearchResult,
  AIMessage,
  ChatResponse,
  IdentifyProductOptions,
  SearchProductsOptions,
  ChatOptions,
  AnalyzeImageOptions,
  NormalizeProductOptions,
  RawProductData,
  NormalizedProduct,
  AIProviderError,
  AIProviderConfigError,
  AIProviderUnavailableError,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// SerpApi Provider
// ─────────────────────────────────────────────────────────────────────────────

export class SerpApiProvider implements AIProvider {
  readonly id = 'serpapi';
  readonly name = 'SerpApi';
  
  private apiKey: string;
  private baseUrl = 'https://serpapi.com';

  constructor(config: Record<string, unknown>) {
    this.apiKey = config.apiKey as string;
    
    if (!this.apiKey) {
      throw new AIProviderConfigError('serpapi', 'apiKey', 'API key is required');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test with a simple search
      const response = await this.makeRequest('/search.json', {
        engine: 'google',
        q: 'test',
        num: 1,
      });
      
      // Check for common error responses
      if (response.error) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async identifyProduct(input: string, options?: IdentifyProductOptions): Promise<ProductCandidate[]> {
    const maxResults = options?.maxResults ?? 10;
    const minConfidence = options?.minConfidence ?? 0.7;
    
    try {
      // Use Google Shopping search to identify products
      const response = await this.makeRequest('/search.json', {
        engine: 'google_shopping',
        q: input,
        num: Math.min(maxResults * 2, 20), // Get extra results to filter
      });

      if (response.error) {
        throw new AIProviderError(
          this.formatError(response.error),
          'serpapi',
          'API_ERROR',
          response.error
        );
      }

      const products: ProductCandidate[] = [];
      const shoppingResults = response.shopping_results || [];

      for (const result of shoppingResults.slice(0, maxResults)) {
        const confidence = this.calculateConfidence(input, result);
        
        if (confidence < minConfidence) continue;

        products.push({
          title: result.title || '',
          brand: this.extractBrand(result.title),
          model: this.extractModel(result.title),
          price: result.price ? parseFloat(result.price.replace(/[^0-9.]/g, '')) : undefined,
          currency: 'USD', // SerpApi usually returns USD, could be enhanced
          retailer: result.source,
          url: result.link,
          images: result.thumbnail ? [result.thumbnail] : [],
          confidence: Math.round(confidence * 100),
          description: result.snippet,
          category: this.inferCategory(result.title),
        });
      }

      return products;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(
        `Failed to identify products: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'serpapi'
      );
    }
  }

  async searchProducts(query: string, options?: SearchProductsOptions): Promise<ProductSearchResult[]> {
    const maxResults = options?.maxResults ?? 20;
    
    try {
      // Use Google Shopping for product-specific searches
      const response = await this.makeRequest('/search.json', {
        engine: 'google_shopping',
        q: query,
        num: maxResults,
        ...(options?.filters?.priceRange && {
          min_price: options.filters.priceRange.min,
          max_price: options.filters.priceRange.max,
        }),
      });

      if (response.error) {
        throw new AIProviderError(
          this.formatError(response.error),
          'serpapi',
          'API_ERROR',
          response.error
        );
      }

      const results: ProductSearchResult[] = [];
      const shoppingResults = response.shopping_results || [];

      for (const [index, result] of shoppingResults.entries()) {
        const relevance = 1 - (index / shoppingResults.length); // Simple relevance based on order
        
        results.push({
          title: result.title || '',
          brand: this.extractBrand(result.title),
          model: this.extractModel(result.title),
          price: result.price ? parseFloat(result.price.replace(/[^0-9.]/g, '')) : undefined,
          currency: 'USD',
          retailer: result.source,
          url: result.link,
          images: result.thumbnail ? [result.thumbnail] : [],
          confidence: 85, // Generally high confidence for direct shopping results
          description: result.snippet,
          category: this.inferCategory(result.title),
          relevance: Math.round(relevance * 100),
          matchReason: `Shopping result #${index + 1}`,
        });
      }

      return results;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(
        `Failed to search products: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'serpapi'
      );
    }
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<ChatResponse> {
    // SerpApi doesn't provide conversational AI
    // For basic functionality, we can implement simple keyword-based responses
    // or throw an error to indicate this provider doesn't support chat
    
    const userMessage = messages.findLast(msg => msg.role === 'user')?.content || '';
    
    // Simple keyword-based responses for product queries
    if (this.isProductQuery(userMessage)) {
      const searchResults = await this.searchProducts(userMessage, { maxResults: 3 });
      
      let response = `I found ${searchResults.length} products matching "${userMessage}":\n\n`;
      
      for (const product of searchResults.slice(0, 3)) {
        response += `• **${product.title}**\n`;
        response += `  ${product.retailer} - $${product.price || 'Price not available'}\n`;
        if (product.url) {
          response += `  [View Product](${product.url})\n`;
        }
        response += '\n';
      }
      
      return {
        message: {
          role: 'assistant',
          content: response,
        },
        finishReason: 'stop',
      };
    }
    
    // For non-product queries, explain limitations
    throw new AIProviderError(
      'SerpApi provider only supports product search, not general conversation. ' +
      'Please configure a conversational AI provider (OpenAI, Anthropic, etc.) for chat features.',
      'serpapi',
      'UNSUPPORTED_FEATURE'
    );
  }

  async analyzeImage(imageUrl: string, options?: AnalyzeImageOptions): Promise<ProductCandidate[]> {
    try {
      // Use Google Lens/Images search
      const response = await this.makeRequest('/search.json', {
        engine: 'google_lens',
        url: imageUrl,
        num: options?.maxResults ?? 10,
      });

      if (response.error) {
        throw new AIProviderError(
          this.formatError(response.error),
          'serpapi',
          'API_ERROR',
          response.error
        );
      }

      const products: ProductCandidate[] = [];
      const visualMatches = response.visual_matches || [];

      for (const match of visualMatches) {
        if (match.title && match.link) {
          products.push({
            title: match.title,
            brand: this.extractBrand(match.title),
            url: match.link,
            images: match.thumbnail ? [match.thumbnail] : [],
            confidence: 75, // Google Lens is generally reliable
            description: match.snippet,
            category: this.inferCategory(match.title),
          });
        }
      }

      return products;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(
        `Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'serpapi'
      );
    }
  }

  async normalizeProduct(productData: RawProductData, options?: NormalizeProductOptions): Promise<NormalizedProduct> {
    // SerpApi doesn't have AI normalization capabilities
    // Implement basic rule-based normalization
    
    const title = productData.title || 'Unknown Product';
    const brand = productData.brand || this.extractBrand(title);
    const model = this.extractModel(title);
    const category = this.inferCategory(title);
    
    return {
      title: this.cleanTitle(title),
      brand,
      model,
      category,
      price: productData.price,
      currency: productData.currency || 'USD',
      identifiers: {
        // SerpApi doesn't provide identifier extraction
      },
      images: Array.isArray(productData.images) ? productData.images : [],
      specifications: {},
      confidence: 60, // Rule-based normalization has lower confidence
      changes: [
        {
          field: 'title',
          old: productData.title || '',
          new: this.cleanTitle(title),
          reason: 'Basic title cleanup',
        },
      ],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private async makeRequest(endpoint: string, params: Record<string, unknown>): Promise<any> {
    const url = new URL(endpoint, this.baseUrl);
    
    // Add API key and common parameters
    const searchParams = {
      ...params,
      api_key: this.apiKey,
    };
    
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString());
    const data = await response.json();
    
    return data;
  }

  private formatError(error: any): string {
    if (error?.message?.includes('verification')) {
      return 'Your SerpApi account has not been verified. ' +
             'Finish verifying your account: https://serpapi.com/users/welcome';
    }
    
    return error?.message || 'SerpApi request failed';
  }

  private calculateConfidence(input: string, result: any): number {
    const inputLower = input.toLowerCase();
    const titleLower = (result.title || '').toLowerCase();
    
    // Simple text similarity based on common words
    const inputWords = inputLower.split(/\s+/);
    const titleWords = titleLower.split(/\s+/);
    
    const commonWords = inputWords.filter(word => 
      word.length > 2 && titleWords.some((titleWord: string) => 
        titleWord.includes(word) || word.includes(titleWord)
      )
    );
    
    return Math.min(0.95, commonWords.length / inputWords.length);
  }

  private extractBrand(title: string): string | undefined {
    if (!title) return undefined;
    
    // Simple brand extraction - could be enhanced with a brand database
    const commonBrands = [
      'Apple', 'Samsung', 'Google', 'Sony', 'Microsoft', 'Dell', 'HP', 'Lenovo',
      'Nike', 'Adidas', 'Amazon', 'Canon', 'Nikon', 'LG', 'Panasonic'
    ];
    
    for (const brand of commonBrands) {
      if (title.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }
    
    // Try to extract first word as potential brand
    const words = title.split(/\s+/);
    return words[0];
  }

  private extractModel(title: string): string | undefined {
    // Simple model extraction - look for patterns like numbers/letters
    const modelMatch = title.match(/\b([A-Z0-9]+-?[A-Z0-9]*-?[A-Z0-9]*)\b/);
    return modelMatch ? modelMatch[1] : undefined;
  }

  private inferCategory(title: string): string | undefined {
    if (!title) return undefined;
    
    const titleLower = title.toLowerCase();
    
    const categories = {
      'Electronics': ['phone', 'laptop', 'tablet', 'tv', 'camera', 'headphone', 'speaker'],
      'Clothing': ['shirt', 'pants', 'dress', 'jacket', 'shoes', 'hat'],
      'Home': ['furniture', 'decor', 'kitchen', 'bedding', 'bath'],
      'Sports': ['fitness', 'exercise', 'sport', 'outdoor', 'running'],
      'Books': ['book', 'novel', 'textbook', 'guide'],
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => titleLower.includes(keyword))) {
        return category;
      }
    }
    
    return undefined;
  }

  private cleanTitle(title: string): string {
    // Basic title cleanup
    return title
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '')
      .trim();
  }

  private isProductQuery(message: string): boolean {
    const productKeywords = [
      'find', 'search', 'looking for', 'buy', 'purchase', 'price', 'cost',
      'where can i get', 'show me', 'recommend', 'best', 'cheapest'
    ];
    
    const messageLower = message.toLowerCase();
    return productKeywords.some(keyword => messageLower.includes(keyword));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Metadata
// ─────────────────────────────────────────────────────────────────────────────

export const SerpApiMetadata = {
  id: 'serpapi',
  name: 'SerpApi',
  description: 'Google Shopping and search results API. Great for product discovery and price comparison.',
  homepage: 'https://serpapi.com',
  pricing: {
    type: 'freemium' as const,
    description: 'Free tier: 100 searches/month. Paid plans available.',
  },
  features: {
    chat: false, // Limited chat functionality
    vision: true, // Google Lens integration
    tools: false,
    search: true,
    identifyProduct: true,
    normalizeProduct: true, // Basic rule-based normalization
  },
  models: [
    {
      id: 'google_shopping',
      name: 'Google Shopping',
      capabilities: ['product_search', 'price_comparison'],
    },
    {
      id: 'google_lens',
      name: 'Google Lens',
      capabilities: ['image_search', 'visual_matching'],
    },
  ],
  configSchema: {
    apiKey: {
      type: 'string' as const,
      label: 'API Key',
      description: 'Your SerpApi API key (get one free at serpapi.com)',
      required: true,
    },
  },
};