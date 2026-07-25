/**
 * Product Getter — AI-assisted product identification and parsing.
 *
 * Uses Puter.js to understand messy user input (product names, shopping lists,
 * component lists, descriptions) and extract structured product information.
 *
 * Flow:
 *   User Input → Puter AI Parser → Extract product info → DerList Product Matcher
 *
 * The AI identifies products and extracts metadata. The existing DerList pipeline
 * handles matching, deduplication, pricing, and persistence.
 */

import { puterChat, puterChatWithMedia, isPuterAvailable } from './puter';
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
    inStock: boolean | null;
    url: string | null;
    image: string | null;
  };
  matchConfidence: number;
}

export interface ImageAnalysisResult {
  success: boolean;
  products: ParsedProduct[];
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser Prompt
// ─────────────────────────────────────────────────────────────────────────────

const PARSER_PROMPT = `You are a product identification expert. Given user input (product names, shopping lists, component lists, messy descriptions, or partial info), extract structured product information.

For EACH product you identify, return a JSON object with:
- title: Full product name (best guess)
- brand: Manufacturer/brand name
- model: Model number or name
- sku: SKU if identifiable
- mpn: Manufacturer part number if identifiable
- gtin: GTIN/EAN/ISBN if present
- upc: UPC barcode if present
- asin: Amazon ASIN if present
- category: Product category (e.g., "CPU", "GPU", "Motherboard", "SSD", "RAM", "Monitor", "Headphones")
- estimatedPrice: Rough price estimate in USD if you know it (null if unsure)
- confidence: 0-100 how confident you are in this identification

Rules:
1. Return ONLY a JSON array of product objects. No other text.
2. Be specific with titles — include brand, model, and key specs when possible.
3. For shorthand like "7800X3D", expand to "AMD Ryzen 7 7800X3D".
4. For ambiguous input, give your best guess and lower the confidence.
5. If input contains pricing, extract it into estimatedPrice.
6. Common abbreviations: GPU=Graphics Card, CPU=Processor, RAM=Memory, SSD/HDD=Storage, PSU=Power Supply, AIO=CPU Cooler, MOBO=Motherboard.
7. Return an empty array [] if no products can be identified.`;

const IMAGE_PARSER_PROMPT = `You are a product identification expert analyzing an image. Identify all products visible in the image (shopping carts, product pages, receipts, wishlists, PC builds, etc.).

For EACH product you can identify, return a JSON object with:
- title: Full product name
- brand: Manufacturer/brand
- model: Model number
- sku: SKU if visible
- mpn: MPN if visible
- gtin: null (usually not visible)
- upc: null (usually not visible)
- asin: ASIN if visible (Amazon pages)
- category: Product category
- estimatedPrice: Price if visible in the image
- confidence: 0-100 confidence in identification

Rules:
1. Return ONLY a JSON array. No other text.
2. Only identify products you can actually see or read in the image.
3. If you can read a price, include it. Otherwise null.
4. Lower confidence for partially visible or blurry products.
5. Return an empty array [] if no products are identifiable.`;

// ─────────────────────────────────────────────────────────────────────────────
// Parse Text Input
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse messy text input into structured product information.
 * Supports: product names, shopping lists, component lists, descriptions, URLs.
 */
export async function parseProducts(input: string, model = 'gpt-4o'): Promise<ProductGetterResult> {
  if (!isPuterAvailable()) {
    return { success: false, parsed: [], matched: [], unmatched: [], error: 'AI not configured.' };
  }

  if (!input || input.trim().length < 2) {
    return { success: false, parsed: [], matched: [], unmatched: [], error: 'Input too short.' };
  }

  try {
    const response = await puterChat(
      [
        { role: 'system', content: PARSER_PROMPT },
        { role: 'user', content: input },
      ],
      { model },
    );

    const content = typeof response.message.content === 'string'
      ? response.message.content
      : Array.isArray(response.message.content)
        ? response.message.content.map((c: { text?: string }) => c.text ?? '').join('')
        : String(response.message.content ?? '[]');

    const parsed = extractJsonArray(content);
    if (parsed.length === 0) {
      return { success: true, parsed: [], matched: [], unmatched: [], error: 'No products identified in the input.' };
    }

    // Match parsed products against DerList database
    const { matched, unmatched } = await matchParsedProducts(parsed);

    return { success: true, parsed, matched, unmatched };
  } catch (err) {
    return {
      success: false,
      parsed: [],
      matched: [],
      unmatched: [],
      error: `Parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse Image Input
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze an image to identify products (screenshots, shopping carts, etc.).
 * This is candidate identification — products must still be verified via DerList.
 */
export async function parseImage(imageUrl: string, model = 'gpt-4o'): Promise<ProductGetterResult> {
  if (!isPuterAvailable()) {
    return { success: false, parsed: [], matched: [], unmatched: [], error: 'AI not configured.' };
  }

  try {
    const response = await puterChatWithMedia(
      IMAGE_PARSER_PROMPT,
      imageUrl,
      { model },
    );

    const content = typeof response.message.content === 'string'
      ? response.message.content
      : Array.isArray(response.message.content)
        ? response.message.content.map((c: { text?: string }) => c.text ?? '').join('')
        : String(response.message.content ?? '[]');

    const parsed = extractJsonArray(content);
    if (parsed.length === 0) {
      return { success: true, parsed: [], matched: [], unmatched: [], error: 'No products identified in the image.' };
    }

    const { matched, unmatched } = await matchParsedProducts(parsed);

    return { success: true, parsed, matched, unmatched };
  } catch (err) {
    return {
      success: false,
      parsed: [],
      matched: [],
      unmatched: [],
      error: `Image analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Matching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match parsed products against DerList's existing product database.
 * Uses the existing matching strategy: identifiers → title+brand → title search.
 */
async function matchParsedProducts(parsed: ParsedProduct[]): Promise<{
  matched: MatchedProduct[];
  unmatched: ParsedProduct[];
}> {
  const matched: MatchedProduct[] = [];
  const unmatched: ParsedProduct[] = [];

  for (const item of parsed) {
    const product = await findBestMatch(item);
    if (product) {
      matched.push({
        parsed: item,
        product: {
          id: product.id,
          title: product.title,
          brand: product.brand,
          retailer: product.retailer,
          price: product.currentPrice != null ? Number(product.currentPrice) : null,
          currency: product.currency,
          inStock: product.inStock,
          url: product.canonicalUrl,
          image: product.image,
        },
        matchConfidence: product.matchConfidence,
      });
    } else {
      unmatched.push(item);
    }
  }

  return { matched, unmatched };
}

/**
 * Find the best matching product in DerList's database using progressive matching:
 * 1. Match by ASIN
 * 2. Match by UPC/GTIN
 * 3. Match by SKU + brand
 * 4. Match by MPN + brand
 * 5. Match by title + brand
 * 6. Fuzzy title search
 */
async function findBestMatch(
  parsed: ParsedProduct,
): Promise<{
  id: string;
  title: string;
  brand: string | null;
  retailer: string | null;
  currentPrice: unknown;
  currency: string;
  inStock: boolean | null;
  canonicalUrl: string | null;
  image: string | null;
  matchConfidence: number;
} | null> {
  const select = {
    id: true,
    title: true,
    brand: true,
    retailer: true,
    currentPrice: true,
    currency: true,
    inStock: true,
    canonicalUrl: true,
    image: true,
  } as const;

  // 1. ASIN match (highest confidence)
  if (parsed.asin) {
    const byAsin = await prisma.product.findFirst({ where: { asin: parsed.asin }, select });
    if (byAsin) return { ...byAsin, matchConfidence: 98 };
  }

  // 2. UPC/GTIN match
  if (parsed.upc || parsed.gtin) {
    const identifier = parsed.upc || parsed.gtin;
    const byGtin = await prisma.product.findFirst({ where: { gtin: identifier! }, select });
    if (byGtin) return { ...byGtin, matchConfidence: 95 };

    const byUpc = await prisma.product.findFirst({ where: { upc: identifier! }, select });
    if (byUpc) return { ...byUpc, matchConfidence: 95 };
  }

  // 3. SKU + brand
  if (parsed.sku && parsed.brand) {
    const bySku = await prisma.product.findFirst({
      where: { sku: parsed.sku, brand: { equals: parsed.brand, mode: 'insensitive' } },
      select,
    });
    if (bySku) return { ...bySku, matchConfidence: 90 };
  }

  // 4. MPN + brand
  if (parsed.mpn && parsed.brand) {
    const byMpn = await prisma.product.findFirst({
      where: { mpn: parsed.mpn, brand: { equals: parsed.brand, mode: 'insensitive' } },
      select,
    });
    if (byMpn) return { ...byMpn, matchConfidence: 88 };
  }

  // 5. Exact title + brand
  if (parsed.title && parsed.brand) {
    const byTitleBrand = await prisma.product.findFirst({
      where: {
        title: { equals: parsed.title, mode: 'insensitive' },
        brand: { equals: parsed.brand, mode: 'insensitive' },
      },
      select,
    });
    if (byTitleBrand) return { ...byTitleBrand, matchConfidence: 85 };
  }

  // 6. Fuzzy title search (contains)
  if (parsed.title) {
    // Try the full title first
    const byTitle = await prisma.product.findFirst({
      where: { title: { contains: parsed.title, mode: 'insensitive' } },
      select,
    });
    if (byTitle) return { ...byTitle, matchConfidence: 70 };

    // Try model number if available
    if (parsed.model) {
      const byModel = await prisma.product.findFirst({
        where: { title: { contains: parsed.model, mode: 'insensitive' } },
        select,
      });
      if (byModel) return { ...byModel, matchConfidence: 65 };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract a JSON array from AI response text (handles markdown code blocks).
 */
function extractJsonArray(text: string): ParsedProduct[] {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    const result = JSON.parse(cleaned);
    if (Array.isArray(result)) {
      return result.map(normalizeProduct).filter((p): p is ParsedProduct => p !== null);
    }
    return [];
  } catch {
    // Try to find array in the text
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const result = JSON.parse(match[0]);
        if (Array.isArray(result)) {
          return result.map(normalizeProduct).filter((p): p is ParsedProduct => p !== null);
        }
      } catch {
        return [];
      }
    }
    return [];
  }
}

/**
 * Normalize a raw parsed product into our expected shape.
 */
function normalizeProduct(raw: unknown): ParsedProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const title = typeof obj.title === 'string' ? obj.title.trim() : null;
  if (!title) return null;

  return {
    title,
    brand: typeof obj.brand === 'string' ? obj.brand.trim() || null : null,
    model: typeof obj.model === 'string' ? obj.model.trim() || null : null,
    sku: typeof obj.sku === 'string' ? obj.sku.trim() || null : null,
    mpn: typeof obj.mpn === 'string' ? obj.mpn.trim() || null : null,
    gtin: typeof obj.gtin === 'string' ? obj.gtin.trim() || null : null,
    upc: typeof obj.upc === 'string' ? obj.upc.trim() || null : null,
    asin: typeof obj.asin === 'string' ? obj.asin.trim() || null : null,
    category: typeof obj.category === 'string' ? obj.category.trim() || null : null,
    estimatedPrice: typeof obj.estimatedPrice === 'number' ? obj.estimatedPrice : null,
    confidence: typeof obj.confidence === 'number' ? Math.max(0, Math.min(100, obj.confidence)) : 50,
  };
}
