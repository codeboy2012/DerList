/**
 * Product Repository
 *
 * Data access layer for the Product model.
 * Only place in the app that queries Product-related tables directly.
 */

import type { PriceHistory, Product } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductCreateInput {
  canonicalUrl?: string;
  normalizedUrl?: string;
  domain?: string;
  retailer?: string;
  title: string;
  description?: string;
  brand?: string;
  sku?: string;
  mpn?: string;
  gtin?: string;
  asin?: string;
  upc?: string;
  image?: string;
  gallery?: string[];
  currentPrice?: number;
  currency?: string;
  inStock?: boolean;
  availability?: string;
  specifications?: Record<string, string>;
  source?: 'IMPORTED' | 'MANUAL';
}

export interface ProductSearchResult {
  id: string;
  title: string;
  brand: string | null;
  image: string | null;
  currentPrice: number | null;
  currency: string;
  retailer: string | null;
  canonicalUrl: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────────────────────

export const ProductRepository = {
  /**
   * Find a product by its canonical URL.
   */
  async findByUrl(url: string): Promise<Product | null> {
    return prisma.product.findFirst({
      where: {
        OR: [{ canonicalUrl: url }, { normalizedUrl: url }],
      },
    });
  },

  /**
   * Find a product by ID.
   */
  async findById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({ where: { id } });
  },

  /**
   * Find a product by identifiers (ASIN, UPC, GTIN, SKU, MPN).
   */
  async findByIdentifier(identifier: string): Promise<Product | null> {
    return prisma.product.findFirst({
      where: {
        OR: [
          { asin: identifier },
          { upc: identifier },
          { gtin: identifier },
          { sku: identifier },
          { mpn: identifier },
          { retailerProductId: identifier },
        ],
      },
    });
  },

  /**
   * Search products by title, brand, or retailer.
   * Returns up to `limit` results ordered by relevance.
   */
  async search(query: string, limit = 20): Promise<ProductSearchResult[]> {
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { brand: { contains: query, mode: 'insensitive' } },
          { retailer: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
          { gtin: { contains: query, mode: 'insensitive' } },
          { mpn: { contains: query, mode: 'insensitive' } },
          { asin: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        brand: true,
        image: true,
        currentPrice: true,
        currency: true,
        retailer: true,
        canonicalUrl: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return products.map((p: (typeof products)[number]) => ({
      ...p,
      currentPrice: p.currentPrice ? Number(p.currentPrice) : null,
    }));
  },

  /**
   * Create a new product record.
   */
  async create(input: ProductCreateInput): Promise<Product> {
    return prisma.product.create({
      data: {
        canonicalUrl: input.canonicalUrl ?? null,
        normalizedUrl: input.normalizedUrl ?? null,
        domain: input.domain ?? null,
        retailer: input.retailer ?? null,
        title: input.title,
        description: input.description ?? null,
        brand: input.brand ?? null,
        sku: input.sku ?? null,
        mpn: input.mpn ?? null,
        gtin: input.gtin ?? null,
        asin: input.asin ?? null,
        upc: input.upc ?? null,
        image: input.image ?? null,
        gallery: input.gallery ? JSON.stringify(input.gallery) : null,
        currentPrice: input.currentPrice ?? null,
        currency: input.currency ?? 'USD',
        inStock: input.inStock ?? null,
        availability: input.availability ?? null,
        specifications: input.specifications ? JSON.stringify(input.specifications) : null,
        source: input.source ?? 'IMPORTED',
        lastFetchedAt: new Date(),
      },
    });
  },

  /**
   * Upsert a product by canonical URL.
   * Creates if not found, updates if URL matches.
   */
  async upsertByUrl(input: ProductCreateInput & { canonicalUrl: string }): Promise<Product> {
    return prisma.product.upsert({
      where: { canonicalUrl: input.canonicalUrl },
      create: {
        canonicalUrl: input.canonicalUrl,
        normalizedUrl: input.normalizedUrl ?? null,
        domain: input.domain ?? null,
        retailer: input.retailer ?? null,
        title: input.title,
        description: input.description ?? null,
        brand: input.brand ?? null,
        sku: input.sku ?? null,
        mpn: input.mpn ?? null,
        gtin: input.gtin ?? null,
        asin: input.asin ?? null,
        upc: input.upc ?? null,
        image: input.image ?? null,
        gallery: input.gallery ? JSON.stringify(input.gallery) : null,
        currentPrice: input.currentPrice ?? null,
        currency: input.currency ?? 'USD',
        inStock: input.inStock ?? null,
        availability: input.availability ?? null,
        specifications: input.specifications ? JSON.stringify(input.specifications) : null,
        source: input.source ?? 'IMPORTED',
        lastFetchedAt: new Date(),
      },
      update: {
        title: input.title,
        description: input.description ?? undefined,
        brand: input.brand ?? undefined,
        image: input.image ?? undefined,
        currentPrice: input.currentPrice ?? undefined,
        inStock: input.inStock ?? undefined,
        availability: input.availability ?? undefined,
        lastFetchedAt: new Date(),
        refreshCount: { increment: 1 },
      },
    });
  },

  /**
   * Update a product's price and record in price history.
   */
  async updatePrice(
    productId: string,
    price: number,
    currency: string,
    extractionMethod?: string,
    confidence?: number
  ): Promise<void> {
    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: {
          currentPrice: price,
          currency,
          lastFetchedAt: new Date(),
          lastExtractionMethod: extractionMethod,
          avgConfidence: confidence,
        },
      }),
      prisma.priceHistory.create({
        data: {
          productId,
          price,
          currency,
          extractionMethod,
          extractionConfidence: confidence,
        },
      }),
    ]);
  },

  /**
   * Get price history for a product.
   */
  async getPriceHistory(productId: string, days = 90): Promise<PriceHistory[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return prisma.priceHistory.findMany({
      where: {
        productId,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'asc' },
    });
  },

  /**
   * Count total products.
   */
  async count(): Promise<number> {
    return prisma.product.count();
  },
};
