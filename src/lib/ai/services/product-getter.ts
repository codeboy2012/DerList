/**
 * Product Getter Service — Multi-provider AI-assisted product identification and parsing.
 *
 * Uses any configured AI provider to understand messy user input (product names, 
 * shopping lists, component lists, descriptions) and extract structured product information.
 *
 * Flow:
 *   User Input → AI Provider → Extract product info → DerList Product Matcher
 *
 * The AI identifies products and extracts metadata. The existing DerList pipeline
 * handles matching, deduplication, pricing, and persistence.
 */

import { getAIProvider } from '../providers';
import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedProduct {
  title: string;
  brand: string | null;
  model: string | null;
  sku: string | null;
  mpn: string | null;
  gtin: string | null;
  upc: string | null;
  asin: string | null;
  category: string | null;
  estimatedPrice: number | null;
  confidence: number; // 0-100
}

export interface ProductGetterResult {
  success: boolean;
  parsed: ParsedProduct[];
  matched: MatchedProduct[];
  unmatched: ParsedProduct[];
  error?: string;
}

export interface MatchedProduct {
  parsed: ParsedProduct;
  product: {
    id: string;
    title: string;
    brand: string | null;
    retailer: string | null;
    price: number | null;
    currency: string;
    images: string[];
    url: string | null;
  };
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse products from text input using AI
 */
export async function parseProducts(
  input: string, 
  userId: string,
  model = 'gpt-4o'
): Promise<ProductGetterResult> {
  try {
    const provider = await getAIProvider(userId, 'serpapi');
    
    if (!input || input.trim().length < 2) {
      return { success: false, parsed: [], matched: [], unmatched: [], error: 'Input too short.' };
    }

    // Use provider's identifyProduct method
    const candidates = await provider.identifyProduct(input, {
      model,
      maxResults: 20,
      minConfidence: 0.6,
      context: 'text',
    });

    // Convert provider candidates to ParsedProduct format
    const parsed: ParsedProduct[] = candidates.map(candidate => ({
      title: candidate.title,
      brand: candidate.brand || null,
      model: candidate.model || null,
      sku: candidate.sku || null,
      mpn: candidate.mpn || null,
      gtin: candidate.gtin || null,
      upc: candidate.upc || null,
      asin: candidate.asin || null,
      category: candidate.category || null,
      estimatedPrice: candidate.price || null,
      confidence: candidate.confidence,
    }));

    // Match against existing products in database
    const { matched, unmatched } = await matchParsedProducts(parsed);

    return {
      success: true,
      parsed,
      matched,
      unmatched,
    };

  } catch (error) {
    return {
      success: false,
      parsed: [],
      matched: [],
      unmatched: [],
      error: error instanceof Error ? error.message : 'Failed to parse products',
    };
  }
}

/**
 * Parse products from image using AI vision
 */
export async function parseImage(
  imageUrl: string, 
  userId: string,
  model = 'gpt-4o'
): Promise<ProductGetterResult> {
  try {
    const provider = await getAIProvider(userId, 'openai'); // Prefer OpenAI for vision
    
    // Use provider's analyzeImage method
    const candidates = await provider.analyzeImage(imageUrl, {
      model,
      maxResults: 10,
      minConfidence: 0.7,
      prompt: 'Identify any products visible in this image, including their brands, models, and categories.',
    });

    // Convert provider candidates to ParsedProduct format
    const parsed: ParsedProduct[] = candidates.map(candidate => ({
      title: candidate.title,
      brand: candidate.brand || null,
      model: candidate.model || null,
      sku: candidate.sku || null,
      mpn: candidate.mpn || null,
      gtin: candidate.gtin || null,
      upc: candidate.upc || null,
      asin: candidate.asin || null,
      category: candidate.category || null,
      estimatedPrice: candidate.price || null,
      confidence: candidate.confidence,
    }));

    // Match against existing products in database
    const { matched, unmatched } = await matchParsedProducts(parsed);

    return {
      success: true,
      parsed,
      matched,
      unmatched,
    };

  } catch (error) {
    return {
      success: false,
      parsed: [],
      matched: [],
      unmatched: [],
      error: error instanceof Error ? error.message : 'Failed to analyze image',
    };
  }
}

/**
 * Search for products using natural language
 */
export async function searchProducts(
  query: string,
  userId: string,
  options: {
    maxResults?: number;
    category?: string;
    priceRange?: { min?: number; max?: number };
  } = {}
): Promise<ProductGetterResult> {
  try {
    const provider = await getAIProvider(userId, 'serpapi');
    
    // Use provider's searchProducts method
    const searchResults = await provider.searchProducts(query, {
      maxResults: options.maxResults || 20,
      filters: {
        category: options.category,
        priceRange: options.priceRange,
      },
    });

    // Convert search results to ParsedProduct format
    const parsed: ParsedProduct[] = searchResults.map(result => ({
      title: result.title,
      brand: result.brand || null,
      model: result.model || null,
      sku: result.sku || null,
      mpn: result.mpn || null,
      gtin: result.gtin || null,
      upc: result.upc || null,
      asin: result.asin || null,
      category: result.category || null,
      estimatedPrice: result.price || null,
      confidence: result.confidence,
    }));

    // Match against existing products in database
    const { matched, unmatched } = await matchParsedProducts(parsed);

    return {
      success: true,
      parsed,
      matched,
      unmatched,
    };

  } catch (error) {
    return {
      success: false,
      parsed: [],
      matched: [],
      unmatched: [],
      error: error instanceof Error ? error.message : 'Failed to search products',
    };
  }
}

/**
 * Normalize and enhance product data
 */
export async function normalizeProduct(
  productData: Record<string, unknown>,
  userId: string,
  model = 'gpt-4o'
): Promise<{
  success: boolean;
  normalized?: any;
  error?: string;
}> {
  try {
    const provider = await getAIProvider(userId, 'openai'); // Prefer OpenAI for normalization
    
    const result = await provider.normalizeProduct(productData, {
      model,
      fields: ['title', 'brand', 'category', 'identifiers', 'specifications'],
    });

    return {
      success: true,
      normalized: result,
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to normalize product',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match parsed products against existing products in the database
 */
async function matchParsedProducts(parsed: ParsedProduct[]): Promise<{
  matched: MatchedProduct[];
  unmatched: ParsedProduct[];
}> {
  const matched: MatchedProduct[] = [];
  const unmatched: ParsedProduct[] = [];

  for (const parsedProduct of parsed) {
    try {
      // Try to find matching product in database
      const dbProduct = await findMatchingProduct(parsedProduct);
      
      if (dbProduct) {
        matched.push({
          parsed: parsedProduct,
          product: {
            id: dbProduct.id,
            title: dbProduct.title,
            brand: dbProduct.brand,
            retailer: dbProduct.retailer,
            price: dbProduct.price,
            currency: dbProduct.currency,
            images: dbProduct.images || [],
            url: dbProduct.url,
          },
          confidence: calculateMatchConfidence(parsedProduct, dbProduct),
        });
      } else {
        unmatched.push(parsedProduct);
      }
    } catch (error) {
      // If matching fails, treat as unmatched
      unmatched.push(parsedProduct);
    }
  }

  return { matched, unmatched };
}

/**
 * Find a matching product in the database
 */
async function findMatchingProduct(parsed: ParsedProduct): Promise<any | null> {
  // Try exact identifier matches first
  if (parsed.sku || parsed.mpn || parsed.gtin || parsed.upc || parsed.asin) {
    const exactMatch = await prisma.product.findFirst({
      where: {
        OR: [
          ...(parsed.sku ? [{ sku: parsed.sku }] : []),
          ...(parsed.mpn ? [{ mpn: parsed.mpn }] : []),
          ...(parsed.gtin ? [{ gtin: parsed.gtin }] : []),
          ...(parsed.upc ? [{ upc: parsed.upc }] : []),
          ...(parsed.asin ? [{ asin: parsed.asin }] : []),
        ],
      },
    });

    if (exactMatch) return exactMatch;
  }

  // Try fuzzy title and brand matching
  const titleWords = parsed.title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  if (titleWords.length > 0) {
    const fuzzyMatches = await prisma.product.findMany({
      where: {
        AND: [
          {
            title: {
              contains: titleWords[0],
              mode: 'insensitive' as const,
            },
          },
          ...(parsed.brand ? [{
            brand: {
              contains: parsed.brand,
              mode: 'insensitive' as const,
            },
          }] : []),
        ],
      },
      take: 5,
    });

    // Return the first fuzzy match (could be enhanced with similarity scoring)
    return fuzzyMatches[0] || null;
  }

  return null;
}

/**
 * Calculate confidence score for a product match
 */
function calculateMatchConfidence(parsed: ParsedProduct, dbProduct: any): number {
  let confidence = 0;

  // Exact identifier matches get high confidence
  if (parsed.sku && parsed.sku === dbProduct.sku) confidence += 40;
  if (parsed.mpn && parsed.mpn === dbProduct.mpn) confidence += 40;
  if (parsed.gtin && parsed.gtin === dbProduct.gtin) confidence += 40;
  if (parsed.upc && parsed.upc === dbProduct.upc) confidence += 40;
  if (parsed.asin && parsed.asin === dbProduct.asin) confidence += 40;

  // Brand match
  if (parsed.brand && dbProduct.brand &&
      parsed.brand.toLowerCase() === dbProduct.brand.toLowerCase()) {
    confidence += 20;
  }

  // Title similarity (simple word overlap)
  if (parsed.title && dbProduct.title) {
    const parsedWords = parsed.title.toLowerCase().split(/\s+/);
    const dbWords = dbProduct.title.toLowerCase().split(/\s+/);
    const overlap = parsedWords.filter(word => 
      word.length > 2 && dbWords.some((dbWord: string) => 
        dbWord.includes(word) || word.includes(dbWord)
      )
    );
    confidence += Math.min(30, (overlap.length / parsedWords.length) * 30);
  }

  return Math.min(100, Math.max(0, confidence));
}

// ─────────────────────────────────────────────────────────────────────────────
// Availability Check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if product getter AI is available for a user
 */
export async function isProductGetterAvailable(userId: string): Promise<boolean> {
  try {
    const provider = await getAIProvider(userId);
    return provider.id !== null;
  } catch (error) {
    return false;
  }
}