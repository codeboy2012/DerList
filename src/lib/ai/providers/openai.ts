/**
 * OpenAI Provider Implementation
 * 
 * Full-featured AI provider using OpenAI's GPT models. Supports chat, vision,
 * function calling, and all core AI operations. Premium option for users
 * who want the best AI capabilities.
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
  AITool,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Provider
// ─────────────────────────────────────────────────────────────────────────────

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  
  private apiKey: string;
  private baseUrl: string;
  private organization?: string;

  constructor(config: Record<string, unknown>) {
    this.apiKey = config.apiKey as string;
    this.baseUrl = (config.baseUrl as string) || 'https://api.openai.com/v1';
    this.organization = config.organization as string;
    
    if (!this.apiKey) {
      throw new AIProviderConfigError('openai', 'apiKey', 'API key is required');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/models');
      return response.data && Array.isArray(response.data);
    } catch (error) {
      return false;
    }
  }

  async identifyProduct(input: string, options?: IdentifyProductOptions): Promise<ProductCandidate[]> {
    const model = options?.model || 'gpt-4o';
    const maxResults = options?.maxResults || 10;
    const minConfidence = options?.minConfidence || 0.7;

    const systemPrompt = `You are a product identification expert. Given user input, identify and extract structured product information.

Return a JSON array of products with this exact structure:
{
  "products": [
    {
      "title": "Product name",
      "brand": "Brand name or null",
      "model": "Model number/name or null", 
      "category": "Category or null",
      "price": number or null,
      "currency": "USD" or other currency,
      "sku": "SKU or null",
      "mpn": "Manufacturer part number or null",
      "gtin": "GTIN/EAN or null", 
      "upc": "UPC or null",
      "asin": "Amazon ASIN or null",
      "confidence": confidence_score_0_to_100,
      "description": "Brief description or null"
    }
  ]
}

Rules:
- Extract multiple products if the input contains multiple items
- Use null for unknown fields, never empty strings
- Confidence should reflect how certain you are about the identification
- Include reasonable price estimates based on typical market values
- Category should be broad (Electronics, Clothing, Home, etc.)`;

    try {
      const response = await this.chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input },
      ], { model, temperature: 0.1 });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIProviderError('No response from OpenAI', 'openai');
      }

      const parsed = JSON.parse(content);
      const products = parsed.products || [];

      return products
        .filter((p: any) => p.confidence >= minConfidence * 100)
        .slice(0, maxResults)
        .map((p: any) => ({
          title: p.title || '',
          brand: p.brand || undefined,
          model: p.model || undefined,
          category: p.category || undefined,
          price: p.price || undefined,
          currency: p.currency || 'USD',
          sku: p.sku || undefined,
          mpn: p.mpn || undefined,
          gtin: p.gtin || undefined,
          upc: p.upc || undefined,
          asin: p.asin || undefined,
          confidence: Math.round(p.confidence || 0),
          description: p.description || undefined,
        }));

    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(
        `Failed to identify products: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'openai'
      );
    }
  }

  async searchProducts(query: string, options?: SearchProductsOptions): Promise<ProductSearchResult[]> {
    const model = options?.model || 'gpt-4o';
    const maxResults = options?.maxResults || 20;

    const systemPrompt = `You are a product search expert. Given a search query, generate realistic product search results.

Return a JSON array with this structure:
{
  "products": [
    {
      "title": "Product name",
      "brand": "Brand or null",
      "model": "Model or null",
      "category": "Category or null", 
      "price": estimated_price_number,
      "currency": "USD",
      "retailer": "Likely retailer name",
      "url": "Realistic product URL or null",
      "images": ["image_url_or_null"],
      "confidence": 85,
      "description": "Product description",
      "relevance": relevance_score_0_to_100,
      "matchReason": "Why this matches the search"
    }
  ]
}

Generate ${maxResults} realistic products that would match the search query. Make prices realistic for current market conditions.`;

    try {
      const response = await this.chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ], { model, temperature: 0.3 });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIProviderError('No response from OpenAI', 'openai');
      }

      const parsed = JSON.parse(content);
      const products = parsed.products || [];

      return products.slice(0, maxResults).map((p: any) => ({
        title: p.title || '',
        brand: p.brand || undefined,
        model: p.model || undefined,
        category: p.category || undefined,
        price: p.price || undefined,
        currency: p.currency || 'USD',
        retailer: p.retailer || undefined,
        url: p.url || undefined,
        images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
        confidence: Math.round(p.confidence || 85),
        description: p.description || undefined,
        relevance: Math.round(p.relevance || 90),
        matchReason: p.matchReason || 'AI-generated result',
      }));

    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(
        `Failed to search products: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'openai'
      );
    }
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const model = options?.model || 'gpt-4o';
    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxTokens;

    try {
      const openaiMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name }),
        ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
      }));

      const requestBody: any = {
        model,
        messages: openaiMessages,
        temperature,
        ...(maxTokens && { max_tokens: maxTokens }),
        ...(options?.tools && { tools: options.tools }),
      };

      const response = await this.chatCompletion(messages, {
        model,
        temperature,
        max_tokens: maxTokens,
        tools: options?.tools,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new AIProviderError('No response from OpenAI', 'openai');
      }

      return {
        message: {
          role: 'assistant',
          content: choice.message.content || '',
          ...(choice.message.tool_calls && { tool_calls: choice.message.tool_calls }),
        },
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        model: response.model,
        finishReason: choice.finish_reason as any,
      };

    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(
        `Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'openai'
      );
    }
  }

  async analyzeImage(imageUrl: string, options?: AnalyzeImageOptions): Promise<ProductCandidate[]> {
    const model = options?.model || 'gpt-4o';
    const prompt = options?.prompt || 'Identify any products visible in this image.';
    const maxResults = options?.maxResults || 10;
    const minConfidence = options?.minConfidence || 0.7;

    const systemPrompt = `You are a visual product identification expert. Analyze the image and identify any products you can see.

Return a JSON array with this structure:
{
  "products": [
    {
      "title": "Product name",
      "brand": "Brand or null",
      "model": "Model or null", 
      "category": "Category or null",
      "price": estimated_price or null,
      "currency": "USD",
      "confidence": confidence_0_to_100,
      "description": "What you see in the image"
    }
  ]
}

Only include products you can identify with reasonable confidence.`;

    try {
      const response = await this.chatCompletion([
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ] as any
        },
      ], { model, temperature: 0.1 });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIProviderError('No response from OpenAI vision', 'openai');
      }

      const parsed = JSON.parse(content);
      const products = parsed.products || [];

      return products
        .filter((p: any) => p.confidence >= minConfidence * 100)
        .slice(0, maxResults)
        .map((p: any) => ({
          title: p.title || '',
          brand: p.brand || undefined,
          model: p.model || undefined,
          category: p.category || undefined,
          price: p.price || undefined,
          currency: p.currency || 'USD',
          confidence: Math.round(p.confidence || 0),
          description: p.description || undefined,
          images: [imageUrl],
        }));

    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(
        `Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'openai'
      );
    }
  }

  async normalizeProduct(productData: RawProductData, options?: NormalizeProductOptions): Promise<NormalizedProduct> {
    const model = options?.model || 'gpt-4o';
    const fields = options?.fields || ['title', 'brand', 'category', 'identifiers', 'specifications'];

    const systemPrompt = `You are a product data normalization expert. Clean up and enhance the provided product data.

Return a JSON object with this structure:
{
  "title": "Cleaned product title",
  "brand": "Brand name or null",
  "model": "Model or null",
  "category": "Category or null",
  "price": price_number_or_null,
  "currency": "USD",
  "identifiers": {
    "sku": "SKU or null",
    "mpn": "MPN or null", 
    "gtin": "GTIN or null",
    "upc": "UPC or null",
    "asin": "ASIN or null"
  },
  "images": ["cleaned_image_urls"],
  "specifications": {"key": "value"},
  "confidence": confidence_0_to_100,
  "changes": [
    {
      "field": "field_name",
      "old": "old_value", 
      "new": "new_value",
      "reason": "Why changed"
    }
  ]
}

Focus on: ${fields.join(', ')}`;

    try {
      const response = await this.chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(productData, null, 2) },
      ], { model, temperature: 0.1 });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIProviderError('No response from OpenAI', 'openai');
      }

      const parsed = JSON.parse(content);
      
      return {
        title: parsed.title || 'Unknown Product',
        brand: parsed.brand || undefined,
        model: parsed.model || undefined,
        category: parsed.category || undefined,
        price: parsed.price || undefined,
        currency: parsed.currency || 'USD',
        identifiers: {
          sku: parsed.identifiers?.sku || undefined,
          mpn: parsed.identifiers?.mpn || undefined,
          gtin: parsed.identifiers?.gtin || undefined,
          upc: parsed.identifiers?.upc || undefined,
          asin: parsed.identifiers?.asin || undefined,
        },
        images: Array.isArray(parsed.images) ? parsed.images : [],
        specifications: parsed.specifications || {},
        confidence: Math.round(parsed.confidence || 90),
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
      };

    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(
        `Failed to normalize product: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'openai'
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private async makeRequest(endpoint: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    
    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers,
      ...(body && { body: JSON.stringify(body) }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new AIProviderError(
        data.error?.message || 'OpenAI API error',
        'openai',
        data.error?.code,
        data
      );
    }
    
    return data;
  }

  private async chatCompletion(messages: AIMessage[], options: any = {}): Promise<any> {
    return this.makeRequest('/chat/completions', {
      model: options.model || 'gpt-4o',
      messages,
      ...options,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Metadata
// ─────────────────────────────────────────────────────────────────────────────

export const OpenAIMetadata = {
  id: 'openai',
  name: 'OpenAI',
  description: 'Premium AI provider with GPT-4, vision, and function calling. Best-in-class capabilities.',
  homepage: 'https://openai.com',
  pricing: {
    type: 'paid' as const,
    description: 'Pay-per-use pricing. Approximately $0.03/1K tokens for GPT-4.',
  },
  features: {
    chat: true,
    vision: true,
    tools: true,
    search: true, // AI-generated searches
    identifyProduct: true,
    normalizeProduct: true,
  },
  models: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      capabilities: ['chat', 'vision', 'tools', 'reasoning'],
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      capabilities: ['chat', 'vision', 'tools'],
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      capabilities: ['chat', 'vision', 'tools'],
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      capabilities: ['chat', 'tools'],
    },
  ],
  configSchema: {
    apiKey: {
      type: 'string' as const,
      label: 'API Key',
      description: 'Your OpenAI API key (get one at platform.openai.com)',
      required: true,
    },
    organization: {
      type: 'string' as const,
      label: 'Organization ID',
      description: 'Optional: Your OpenAI organization ID',
      required: false,
    },
    baseUrl: {
      type: 'string' as const,
      label: 'Base URL',
      description: 'Optional: Custom API base URL (for OpenAI-compatible APIs)',
      required: false,
      default: 'https://api.openai.com/v1',
    },
  },
};