/**
 * DerList AI Tools — Controlled functions the Shopping AI can invoke.
 *
 * These wrap existing Prisma queries and DerList services into safe,
 * read/write-controlled operations. The AI never touches Prisma directly.
 *
 * Architecture:
 *   User → Shopping AI → Puter.js → These Tools → Existing Product System → DB
 */

import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ProductSummary {
  id: string;
  title: string;
  brand: string | null;
  retailer: string | null;
  image: string | null;
  price: number | null;
  currency: string;
  inStock: boolean | null;
  url: string | null;
  domain: string | null;
  sku: string | null;
  gtin: string | null;
  mpn: string | null;
  source: string;
  lastFetchedAt: string | null;
  avgConfidence: number | null;
}

export interface PriceRecord {
  price: number;
  currency: string;
  recordedAt: string;
  availability: string | null;
  extractionMethod: string | null;
  extractionConfidence: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// searchProducts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search DerList's product database by query string.
 * Matches title, brand, retailer, SKU, GTIN, MPN, domain, description.
 */
export async function searchProducts(args: {
  query: string;
  maxResults?: number;
  maxPrice?: number;
  minPrice?: number;
  brand?: string;
  retailer?: string;
  inStockOnly?: boolean;
}): Promise<ToolResult> {
  const { query, maxResults = 10, maxPrice, minPrice, brand, retailer, inStockOnly } = args;

  if (!query || query.trim().length < 2) {
    return { success: false, error: 'Query must be at least 2 characters.' };
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        AND: [
          {
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
          ...(brand ? [{ brand: { contains: brand, mode: 'insensitive' as const } }] : []),
          ...(retailer ? [{ retailer: { contains: retailer, mode: 'insensitive' as const } }] : []),
          ...(inStockOnly ? [{ inStock: true }] : []),
          ...(maxPrice != null ? [{ currentPrice: { lte: maxPrice } }] : []),
          ...(minPrice != null ? [{ currentPrice: { gte: minPrice } }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(maxResults, 20),
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
        source: true,
        lastFetchedAt: true,
        avgConfidence: true,
      },
    });

    const results: ProductSummary[] = products.map(serializeProduct);
    return { success: true, data: { results, count: results.length } };
  } catch (err) {
    return { success: false, error: `Search failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getProduct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get full product details by ID.
 */
export async function getProduct(args: { productId: string }): Promise<ToolResult> {
  const { productId } = args;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        description: true,
        brand: true,
        retailer: true,
        image: true,
        currentPrice: true,
        currency: true,
        inStock: true,
        availability: true,
        canonicalUrl: true,
        domain: true,
        sku: true,
        gtin: true,
        mpn: true,
        asin: true,
        upc: true,
        source: true,
        lastFetchedAt: true,
        avgConfidence: true,
        refreshCount: true,
        specifications: true,
        _count: { select: { wishlistItems: true, priceHistory: true } },
      },
    });

    if (!product) {
      return { success: false, error: 'Product not found.' };
    }

    return {
      success: true,
      data: {
        ...serializeProduct(product as Parameters<typeof serializeProduct>[0]),
        description: product.description,
        availability: product.availability,
        asin: product.asin,
        upc: product.upc,
        refreshCount: product.refreshCount,
        specifications: product.specifications ? safeJsonParse(product.specifications) : null,
        trackingCount: product._count.wishlistItems,
        priceHistoryCount: product._count.priceHistory,
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to get product: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// compareProducts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare 2-5 products side by side.
 */
export async function compareProducts(args: { productIds: string[] }): Promise<ToolResult> {
  const { productIds } = args;

  if (!productIds || productIds.length < 2 || productIds.length > 5) {
    return { success: false, error: 'Provide 2 to 5 product IDs to compare.' };
  }

  try {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
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
        source: true,
        lastFetchedAt: true,
        avgConfidence: true,
        specifications: true,
      },
    });

    const comparison = products.map((p) => ({
      ...serializeProduct(p as Parameters<typeof serializeProduct>[0]),
      specifications: p.specifications ? safeJsonParse(p.specifications) : null,
    }));

    return { success: true, data: { products: comparison } };
  } catch (err) {
    return { success: false, error: `Comparison failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findSimilarProducts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find products similar to a given product (same brand/category/price range).
 */
export async function findSimilarProducts(args: {
  productId: string;
  maxResults?: number;
}): Promise<ToolResult> {
  const { productId, maxResults = 5 } = args;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { brand: true, retailer: true, currentPrice: true, title: true },
    });

    if (!product) {
      return { success: false, error: 'Product not found.' };
    }

    const price = product.currentPrice ? Number(product.currentPrice) : null;
    const priceRange = price ? { gte: price * 0.5, lte: price * 1.5 } : undefined;

    // Find products with same brand or similar price range, excluding the original
    const similar = await prisma.product.findMany({
      where: {
        id: { not: productId },
        OR: [
          ...(product.brand ? [{ brand: { equals: product.brand, mode: 'insensitive' as const } }] : []),
          ...(priceRange ? [{ currentPrice: priceRange }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(maxResults, 10),
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
        source: true,
        lastFetchedAt: true,
        avgConfidence: true,
      },
    });

    return { success: true, data: { results: similar.map(serializeProduct), count: similar.length } };
  } catch (err) {
    return { success: false, error: `Failed to find similar products: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// checkCompatibility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check compatibility between products (reads specs/brand info).
 * Returns product details so the AI can reason about compatibility.
 */
export async function checkCompatibility(args: { productIds: string[] }): Promise<ToolResult> {
  const { productIds } = args;

  if (!productIds || productIds.length < 2) {
    return { success: false, error: 'Provide at least 2 product IDs to check compatibility.' };
  }

  try {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        title: true,
        brand: true,
        description: true,
        specifications: true,
        sku: true,
        mpn: true,
      },
    });

    const details = products.map((p) => ({
      id: p.id,
      title: p.title,
      brand: p.brand,
      description: p.description?.slice(0, 500) ?? null,
      specifications: p.specifications ? safeJsonParse(p.specifications) : null,
      sku: p.sku,
      mpn: p.mpn,
    }));

    return {
      success: true,
      data: {
        products: details,
        note: 'Use the product specifications, brands, and descriptions to determine compatibility. DerList does not have a dedicated compatibility database yet — use your knowledge to reason about these products.',
      },
    };
  } catch (err) {
    return { success: false, error: `Compatibility check failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getPriceHistory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get price history for a product.
 */
export async function getPriceHistory(args: {
  productId: string;
  limit?: number;
}): Promise<ToolResult> {
  const { productId, limit = 30 } = args;

  try {
    const records = await prisma.priceHistory.findMany({
      where: { productId },
      orderBy: { recordedAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        price: true,
        currency: true,
        recordedAt: true,
        availability: true,
        extractionMethod: true,
        extractionConfidence: true,
      },
    });

    if (records.length === 0) {
      return { success: true, data: { records: [], summary: 'No price history available for this product.' } };
    }

    const prices = records.map((r) => Number(r.price));
    const serialized: PriceRecord[] = records.map((r) => ({
      price: Number(r.price),
      currency: r.currency,
      recordedAt: r.recordedAt.toISOString(),
      availability: r.availability,
      extractionMethod: r.extractionMethod,
      extractionConfidence: r.extractionConfidence,
    }));

    return {
      success: true,
      data: {
        records: serialized,
        summary: {
          count: records.length,
          lowest: Math.min(...prices),
          highest: Math.max(...prices),
          average: Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)),
          current: prices[0],
          currency: records[0].currency,
        },
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to get price history: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// addToWishlist
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a product to a user's wishlist. Requires userId for ownership verification.
 */
export async function addToWishlist(args: {
  userId: string;
  wishlistId: string;
  productId: string;
  starPriority?: number;
  notes?: string;
  category?: string;
}): Promise<ToolResult> {
  const { userId, wishlistId, productId, starPriority = 1, notes, category } = args;

  try {
    // Verify ownership
    const wishlist = await prisma.wishlist.findUnique({
      where: { id: wishlistId },
      select: { ownerId: true, title: true },
    });

    if (!wishlist || wishlist.ownerId !== userId) {
      return { success: false, error: 'Wishlist not found or you do not own it.' };
    }

    // Get the product
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        description: true,
        canonicalUrl: true,
        image: true,
        brand: true,
        retailer: true,
        currentPrice: true,
        currency: true,
      },
    });

    if (!product) {
      return { success: false, error: 'Product not found in DerList database.' };
    }

    // Duplicate check
    const existing = await prisma.wishlistItem.findFirst({
      where: { wishlistId, productId },
      select: { id: true, title: true },
    });

    if (existing) {
      return { success: false, error: `"${existing.title}" is already in "${wishlist.title}".` };
    }

    // Get next position
    const lastItem = await prisma.wishlistItem.findFirst({
      where: { wishlistId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (lastItem?.position ?? -1) + 1;

    await prisma.wishlistItem.create({
      data: {
        wishlistId,
        productId: product.id,
        title: product.title,
        description: product.description,
        url: product.canonicalUrl,
        image: product.image,
        brand: product.brand,
        retailer: product.retailer,
        currentPrice: product.currentPrice,
        currency: product.currency,
        starPriority: Math.max(1, Math.min(4, starPriority)),
        notes: notes || null,
        category: category || null,
        position,
      },
    });

    return {
      success: true,
      data: {
        message: `Added "${product.title}" to "${wishlist.title}".`,
        productTitle: product.title,
        wishlistTitle: wishlist.title,
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to add to wishlist: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateWishlistItem
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update a wishlist item's priority, notes, or category.
 */
export async function updateWishlistItem(args: {
  userId: string;
  itemId: string;
  starPriority?: number;
  notes?: string;
  category?: string;
}): Promise<ToolResult> {
  const { userId, itemId, starPriority, notes, category } = args;

  try {
    // Get item with wishlist for ownership check
    const item = await prisma.wishlistItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        title: true,
        wishlist: { select: { ownerId: true } },
      },
    });

    if (!item || item.wishlist.ownerId !== userId) {
      return { success: false, error: 'Item not found or you do not own it.' };
    }

    const updateData: Record<string, unknown> = {};
    if (starPriority != null) updateData.starPriority = Math.max(1, Math.min(4, starPriority));
    if (notes !== undefined) updateData.notes = notes || null;
    if (category !== undefined) updateData.category = category || null;

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'No fields to update.' };
    }

    await prisma.wishlistItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return {
      success: true,
      data: { message: `Updated "${item.title}".`, itemTitle: item.title },
    };
  } catch (err) {
    return { success: false, error: `Failed to update item: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getUserWishlists (helper for the AI to know which wishlists exist)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the user's wishlists so the AI can suggest which one to add to.
 */
export async function getUserWishlists(args: { userId: string }): Promise<ToolResult> {
  const { userId } = args;

  try {
    const wishlists = await prisma.wishlist.findMany({
      where: { ownerId: userId, archived: false },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        icon: true,
        _count: { select: { items: true } },
      },
    });

    return {
      success: true,
      data: {
        wishlists: wishlists.map((w) => ({
          id: w.id,
          title: w.title,
          icon: w.icon,
          itemCount: w._count.items,
        })),
      },
    };
  } catch (err) {
    return { success: false, error: `Failed to get wishlists: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function serializeProduct(p: {
  id: string;
  title: string;
  brand: string | null;
  retailer: string | null;
  image: string | null;
  currentPrice: unknown;
  currency: string;
  inStock: boolean | null;
  canonicalUrl: string | null;
  domain: string | null;
  sku: string | null;
  gtin: string | null;
  mpn: string | null;
  source: string;
  lastFetchedAt: Date | null;
  avgConfidence: number | null;
}): ProductSummary {
  return {
    id: p.id,
    title: p.title,
    brand: p.brand,
    retailer: p.retailer,
    image: p.image,
    price: p.currentPrice != null ? Number(p.currentPrice) : null,
    currency: p.currency,
    inStock: p.inStock,
    url: p.canonicalUrl,
    domain: p.domain,
    sku: p.sku,
    gtin: p.gtin,
    mpn: p.mpn,
    source: p.source,
    lastFetchedAt: p.lastFetchedAt?.toISOString() ?? null,
    avgConfidence: p.avgConfidence,
  };
}

function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
