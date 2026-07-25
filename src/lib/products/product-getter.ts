/**
 * Unified Product Getter — Single entry point for all product identification.
 *
 * Accepts any input type (URL, text, image, search, manual) and routes through
 * the appropriate pipeline: AI identification → DerList verification → result.
 *
 * Architecture:
 *   Input → Product Getter → AI + Existing Pipeline → Verified Product Candidates
 */

import { importProductFromUrl, type ImportedProductData } from './index';
import { parseProducts, parseImage, type ParsedProduct, type MatchedProduct } from '@/lib/ai/product-getter';
import { isPuterAvailable } from '@/lib/ai/puter';
import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ProductGetterInput =
  | { type: 'url'; url: string }
  | { type: 'text'; text: string }
  | { type: 'image'; image: string }
  | { type: 'search'; query: string }
  | { type: 'manual'; data: ManualProductInput };

export interface ManualProductInput {
  title: string;
  url?: string;
  image?: string;
  brand?: string;
  retailer?: string;
  sku?: string;
  category?: string;
  currentPrice?: number;
  originalPrice?: number;
  currency?: string;
  dealInfo?: string;
  description?: string;
}

export interface ProductCandidate {
  title: string;
  brand: string | null;
  model: string | null;
  sku: string | null;
  mpn: string | null;
  gtin: string | null;
  upc: string | null;
  asin: string | null;
  url: string | null;
  image: string | null;
  retailer: string | null;
  category: string | null;
  description: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  currency: string;
  dealInfo: string | null;
  confidence: number;
  matchType: 'exact' | 'strong' | 'possible' | 'needs_review' | 'new' | 'manual';
  /** Existing DerList product ID if matched */
  productId: string | null;
  /** Whether this data is verified by DerList (not just AI-generated) */
  verified: boolean;
}

export interface ProductGetterResponse {
  success: boolean;
  candidates: ProductCandidate[];
  error?: string;
  /** For multi-product input, which items couldn't be identified */
  unmatched?: ParsedProduct[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identify products from any input type.
 * Routes through the appropriate pipeline and returns verified candidates.
 */
export async function identifyProducts(input: ProductGetterInput): Promise<ProductGetterResponse> {
  switch (input.type) {
    case 'url':
      return handleUrlInput(input.url);
    case 'text':
      return handleTextInput(input.text);
    case 'image':
      return handleImageInput(input.image);
    case 'search':
      return handleSearchInput(input.query);
    case 'manual':
      return handleManualInput(input.data);
    default:
      return { success: false, candidates: [], error: 'Unknown input type.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// URL Handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleUrlInput(url: string): Promise<ProductGetterResponse> {
  const result = await importProductFromUrl(url);

  if (!result.success) {
    return { success: false, candidates: [], error: result.error };
  }

  const data = result.data;
  const candidate = importedDataToCandidate(data);

  return { success: true, candidates: [candidate] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Text Handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleTextInput(text: string): Promise<ProductGetterResponse> {
  // Check if the text is actually a URL
  if (isUrl(text.trim())) {
    return handleUrlInput(text.trim());
  }

  // If AI is not available, fall back to direct database search
  if (!isPuterAvailable()) {
    return handleSearchInput(text);
  }

  const result = await parseProducts(text);

  if (!result.success) {
    // Fall back to database search if AI fails
    return handleSearchInput(text);
  }

  const candidates: ProductCandidate[] = [];

  // Convert matched products to candidates
  for (const match of result.matched) {
    candidates.push(matchedToCandidate(match));
  }

  // Convert unmatched (AI-identified but not in DB) to lower-confidence candidates
  for (const unmatched of result.unmatched) {
    candidates.push(parsedToCandidate(unmatched));
  }

  if (candidates.length === 0) {
    return { success: true, candidates: [], error: 'No products identified in the input.' };
  }

  return {
    success: true,
    candidates,
    unmatched: result.unmatched.length > 0 ? result.unmatched : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleImageInput(imageUrl: string): Promise<ProductGetterResponse> {
  if (!isPuterAvailable()) {
    return { success: false, candidates: [], error: 'AI image analysis is not configured.' };
  }

  const result = await parseImage(imageUrl);

  if (!result.success) {
    return { success: false, candidates: [], error: result.error };
  }

  const candidates: ProductCandidate[] = [];

  for (const match of result.matched) {
    candidates.push(matchedToCandidate(match));
  }

  for (const unmatched of result.unmatched) {
    candidates.push(parsedToCandidate(unmatched));
  }

  if (candidates.length === 0) {
    return { success: true, candidates: [], error: 'No products identified in the image.' };
  }

  return {
    success: true,
    candidates,
    unmatched: result.unmatched.length > 0 ? result.unmatched : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Handler (database search with optional AI interpretation)
// ─────────────────────────────────────────────────────────────────────────────

async function handleSearchInput(query: string): Promise<ProductGetterResponse> {
  if (!query || query.trim().length < 2) {
    return { success: false, candidates: [], error: 'Search query too short.' };
  }

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { brand: { contains: query, mode: 'insensitive' } },
        { retailer: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
        { gtin: { contains: query, mode: 'insensitive' } },
        { mpn: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      title: true,
      brand: true,
      retailer: true,
      image: true,
      currentPrice: true,
      currency: true,
      inStock: true,
      canonicalUrl: true,
      domain: true,
      sku: true,
      gtin: true,
      mpn: true,
      asin: true,
      upc: true,
      description: true,
      avgConfidence: true,
    },
  });

  if (products.length === 0) {
    return { success: true, candidates: [], error: 'No products found matching your search.' };
  }

  // Score results by relevance
  const queryLower = query.toLowerCase();
  const candidates: ProductCandidate[] = products.map((p) => {
    const titleLower = p.title.toLowerCase();
    let confidence = 60;
    if (titleLower === queryLower) confidence = 98;
    else if (titleLower.startsWith(queryLower)) confidence = 90;
    else if (titleLower.includes(queryLower)) confidence = 80;

    return {
      title: p.title,
      brand: p.brand,
      model: null,
      sku: p.sku,
      mpn: p.mpn,
      gtin: p.gtin,
      upc: p.upc,
      asin: p.asin,
      url: p.canonicalUrl,
      image: p.image,
      retailer: p.retailer,
      category: null,
      description: p.description?.slice(0, 200) ?? null,
      currentPrice: p.currentPrice != null ? Number(p.currentPrice) : null,
      originalPrice: null,
      currency: p.currency,
      dealInfo: null,
      confidence,
      matchType: confidenceToMatchType(confidence),
      productId: p.id,
      verified: true,
    };
  });

  // Sort by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);

  return { success: true, candidates };
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual Handler (AI auto-fill for partial data)
// ─────────────────────────────────────────────────────────────────────────────

async function handleManualInput(data: ManualProductInput): Promise<ProductGetterResponse> {
  // First, try to match against existing products using the title
  if (data.title) {
    const searchResult = await handleSearchInput(data.title);
    if (searchResult.candidates.length > 0) {
      // Merge user-provided data with search results
      const topMatch = searchResult.candidates[0];
      const merged: ProductCandidate = {
        ...topMatch,
        // User-provided data takes precedence
        url: data.url || topMatch.url,
        image: data.image || topMatch.image,
        brand: data.brand || topMatch.brand,
        retailer: data.retailer || topMatch.retailer,
        sku: data.sku || topMatch.sku,
        category: data.category || topMatch.category,
        currentPrice: data.currentPrice ?? topMatch.currentPrice,
        originalPrice: data.originalPrice ?? topMatch.originalPrice,
        currency: data.currency || topMatch.currency,
        dealInfo: data.dealInfo || topMatch.dealInfo,
        description: data.description || topMatch.description,
      };
      return { success: true, candidates: [merged, ...searchResult.candidates.slice(1)] };
    }
  }

  // If no match, use AI to identify and enrich if available
  if (isPuterAvailable() && data.title) {
    const aiResult = await parseProducts(data.title);
    if (aiResult.success && aiResult.matched.length > 0) {
      const candidates: ProductCandidate[] = aiResult.matched.map(matchedToCandidate);
      // Merge user data into top candidate
      if (candidates[0]) {
        candidates[0] = {
          ...candidates[0],
          url: data.url || candidates[0].url,
          image: data.image || candidates[0].image,
          brand: data.brand || candidates[0].brand,
          retailer: data.retailer || candidates[0].retailer,
          category: data.category || candidates[0].category,
          currentPrice: data.currentPrice ?? candidates[0].currentPrice,
          originalPrice: data.originalPrice ?? null,
          currency: data.currency || candidates[0].currency,
          dealInfo: data.dealInfo || null,
          description: data.description || candidates[0].description,
        };
      }
      return { success: true, candidates };
    }
  }

  // Fall back to creating a manual candidate
  const candidate: ProductCandidate = {
    title: data.title,
    brand: data.brand || null,
    model: null,
    sku: data.sku || null,
    mpn: null,
    gtin: null,
    upc: null,
    asin: null,
    url: data.url || null,
    image: data.image || null,
    retailer: data.retailer || null,
    category: data.category || null,
    description: data.description || null,
    currentPrice: data.currentPrice ?? null,
    originalPrice: data.originalPrice ?? null,
    currency: data.currency || 'USD',
    dealInfo: data.dealInfo || null,
    confidence: 50,
    matchType: 'manual',
    productId: null,
    verified: false,
  };

  return { success: true, candidates: [candidate] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Converters
// ─────────────────────────────────────────────────────────────────────────────

function importedDataToCandidate(data: ImportedProductData): ProductCandidate {
  return {
    title: data.title,
    brand: data.brand,
    model: null,
    sku: data.sku,
    mpn: data.mpn,
    gtin: data.gtin,
    upc: null,
    asin: null,
    url: data.canonicalUrl,
    image: data.image,
    retailer: data.retailer,
    category: null,
    description: data.description,
    currentPrice: data.currentPrice,
    originalPrice: null,
    currency: data.currency,
    dealInfo: null,
    confidence: data.confidence,
    matchType: confidenceToMatchType(data.confidence),
    productId: null, // Will be resolved during save
    verified: true,
  };
}

function matchedToCandidate(match: MatchedProduct): ProductCandidate {
  return {
    title: match.product.title,
    brand: match.product.brand,
    model: match.parsed.model,
    sku: null,
    mpn: null,
    gtin: null,
    upc: null,
    asin: match.parsed.asin,
    url: match.product.url,
    image: match.product.image,
    retailer: match.product.retailer,
    category: match.parsed.category,
    description: null,
    currentPrice: match.product.price,
    originalPrice: match.parsed.estimatedPrice !== match.product.price ? match.parsed.estimatedPrice : null,
    currency: match.product.currency,
    dealInfo: null,
    confidence: match.matchConfidence,
    matchType: confidenceToMatchType(match.matchConfidence),
    productId: match.product.id,
    verified: true,
  };
}

function parsedToCandidate(parsed: ParsedProduct): ProductCandidate {
  return {
    title: parsed.title,
    brand: parsed.brand,
    model: parsed.model,
    sku: parsed.sku,
    mpn: parsed.mpn,
    gtin: parsed.gtin,
    upc: parsed.upc,
    asin: parsed.asin,
    url: null,
    image: null,
    retailer: null,
    category: parsed.category,
    description: null,
    currentPrice: parsed.estimatedPrice,
    originalPrice: null,
    currency: 'USD',
    dealInfo: null,
    confidence: Math.max(10, parsed.confidence - 20), // Lower confidence for unmatched
    matchType: 'needs_review',
    productId: null,
    verified: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function confidenceToMatchType(confidence: number): ProductCandidate['matchType'] {
  if (confidence >= 90) return 'exact';
  if (confidence >= 75) return 'strong';
  if (confidence >= 55) return 'possible';
  return 'needs_review';
}

function isUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
