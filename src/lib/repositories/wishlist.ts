/**
 * Wishlist Repository
 *
 * Data access layer for Wishlist, WishlistItem, and WishlistCategory models.
 * Only place in the app that queries wishlist-related tables directly.
 */

import type {
  ItemPriority,
  Wishlist,
  WishlistCategory,
  WishlistItem,
  WishlistVisibility,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WishlistWithCounts extends Wishlist {
  _count: { items: number };
}

export interface WishlistItemCreateInput {
  wishlistId: string;
  title: string;
  description?: string;
  url?: string;
  image?: string;
  brand?: string;
  retailer?: string;
  currentPrice?: number;
  originalPrice?: number;
  currency?: string;
  dealInfo?: string;
  priority?: ItemPriority;
  starPriority?: number;
  quantity?: number;
  notes?: string;
  category?: string;
  productId?: string;
  wishlistCategoryId?: string;
}

export interface WishlistItemUpdateInput {
  title?: string;
  description?: string | null;
  url?: string | null;
  image?: string | null;
  brand?: string | null;
  retailer?: string | null;
  currentPrice?: number | null;
  originalPrice?: number | null;
  currency?: string;
  dealInfo?: string | null;
  priority?: ItemPriority;
  starPriority?: number;
  quantity?: number;
  notes?: string | null;
  category?: string | null;
  purchased?: boolean;
  productId?: string | null;
  wishlistCategoryId?: string | null;
}

export interface CategoryCreateInput {
  wishlistId: string;
  name: string;
  description?: string;
  externalLink?: string;
  externalLinkLabel?: string;
  notes?: string;
  icon?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────────────────────

export const WishlistRepository = {
  // ─── Wishlists ───

  /**
   * Get all wishlists for a user with item counts.
   */
  async listByUser(userId: string): Promise<WishlistWithCounts[]> {
    return prisma.wishlist.findMany({
      where: { ownerId: userId, archived: false },
      include: { _count: { select: { items: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  },

  /**
   * Get a single wishlist by ID (with ownership check).
   */
  async findById(id: string, userId: string): Promise<Wishlist | null> {
    return prisma.wishlist.findFirst({
      where: { id, ownerId: userId },
    });
  },

  /**
   * Get a wishlist with all its items and categories.
   */
  async findWithItems(id: string, userId: string) {
    return prisma.wishlist.findFirst({
      where: { id, ownerId: userId },
      include: {
        items: {
          include: { product: true, wishlistCategory: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        },
        categories: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  },

  /**
   * Create a new wishlist.
   */
  async create(data: {
    ownerId: string;
    title: string;
    slug: string;
    description?: string;
    visibility?: WishlistVisibility;
    icon?: string;
    color?: string;
  }): Promise<Wishlist> {
    return prisma.wishlist.create({
      data: {
        ownerId: data.ownerId,
        title: data.title,
        slug: data.slug,
        description: data.description ?? null,
        visibility: data.visibility ?? 'PRIVATE',
        icon: data.icon ?? null,
        color: data.color ?? null,
      },
    });
  },

  /**
   * Update a wishlist.
   */
  async update(
    id: string,
    userId: string,
    data: Partial<{
      title: string;
      slug: string;
      description: string | null;
      visibility: WishlistVisibility;
      icon: string | null;
      color: string | null;
      archived: boolean;
      notice: string | null;
    }>
  ): Promise<Wishlist> {
    return prisma.wishlist.update({
      where: { id, ownerId: userId },
      data,
    });
  },

  /**
   * Delete a wishlist.
   */
  async delete(id: string, userId: string): Promise<void> {
    await prisma.wishlist.delete({
      where: { id, ownerId: userId },
    });
  },

  /**
   * Check if a user owns a wishlist.
   */
  async verifyOwnership(wishlistId: string, userId: string): Promise<boolean> {
    const wl = await prisma.wishlist.findUnique({
      where: { id: wishlistId },
      select: { ownerId: true },
    });
    return wl?.ownerId === userId;
  },

  // ─── Items ───

  /**
   * Add an item to a wishlist.
   */
  async addItem(input: WishlistItemCreateInput): Promise<WishlistItem> {
    // Get next position
    const lastItem = await prisma.wishlistItem.findFirst({
      where: { wishlistId: input.wishlistId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (lastItem?.position ?? -1) + 1;

    return prisma.wishlistItem.create({
      data: {
        wishlistId: input.wishlistId,
        title: input.title,
        description: input.description ?? null,
        url: input.url ?? null,
        image: input.image ?? null,
        brand: input.brand ?? null,
        retailer: input.retailer ?? null,
        currentPrice: input.currentPrice ?? null,
        originalPrice: input.originalPrice ?? null,
        currency: input.currency ?? 'USD',
        dealInfo: input.dealInfo ?? null,
        priority: input.priority ?? 'MEDIUM',
        starPriority: input.starPriority ?? 1,
        quantity: input.quantity ?? 1,
        notes: input.notes ?? null,
        category: input.category ?? null,
        productId: input.productId ?? null,
        wishlistCategoryId: input.wishlistCategoryId ?? null,
        position,
      },
    });
  },

  /**
   * Add multiple items to a wishlist at once (batch import).
   */
  async addItems(
    wishlistId: string,
    items: Omit<WishlistItemCreateInput, 'wishlistId'>[]
  ): Promise<number> {
    const lastItem = await prisma.wishlistItem.findFirst({
      where: { wishlistId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    let position = (lastItem?.position ?? -1) + 1;

    const result = await prisma.wishlistItem.createMany({
      data: items.map((item) => ({
        wishlistId,
        title: item.title,
        description: item.description ?? null,
        url: item.url ?? null,
        image: item.image ?? null,
        brand: item.brand ?? null,
        retailer: item.retailer ?? null,
        currentPrice: item.currentPrice ?? null,
        originalPrice: item.originalPrice ?? null,
        currency: item.currency ?? 'USD',
        dealInfo: item.dealInfo ?? null,
        priority: item.priority ?? 'MEDIUM',
        starPriority: item.starPriority ?? 1,
        quantity: item.quantity ?? 1,
        notes: item.notes ?? null,
        category: item.category ?? null,
        productId: item.productId ?? null,
        wishlistCategoryId: item.wishlistCategoryId ?? null,
        position: position++,
      })),
    });

    return result.count;
  },

  /**
   * Update a wishlist item.
   */
  async updateItem(itemId: string, data: WishlistItemUpdateInput): Promise<WishlistItem> {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.brand !== undefined) updateData.brand = data.brand;
    if (data.retailer !== undefined) updateData.retailer = data.retailer;
    if (data.currentPrice !== undefined) updateData.currentPrice = data.currentPrice;
    if (data.originalPrice !== undefined) updateData.originalPrice = data.originalPrice;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.dealInfo !== undefined) updateData.dealInfo = data.dealInfo;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.starPriority !== undefined) updateData.starPriority = data.starPriority;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.productId !== undefined) updateData.productId = data.productId;
    if (data.wishlistCategoryId !== undefined)
      updateData.wishlistCategoryId = data.wishlistCategoryId;

    if (data.purchased !== undefined) {
      updateData.purchased = data.purchased;
      updateData.purchasedAt = data.purchased ? new Date() : null;
    }

    return prisma.wishlistItem.update({
      where: { id: itemId },
      data: updateData,
    });
  },

  /**
   * Delete a wishlist item.
   */
  async deleteItem(itemId: string): Promise<void> {
    await prisma.wishlistItem.delete({ where: { id: itemId } });
  },

  /**
   * Get a single item by ID.
   */
  async findItem(itemId: string): Promise<WishlistItem | null> {
    return prisma.wishlistItem.findUnique({
      where: { id: itemId },
    });
  },

  // ─── Categories ───

  /**
   * Create a category within a wishlist.
   */
  async createCategory(input: CategoryCreateInput): Promise<WishlistCategory> {
    const lastCat = await prisma.wishlistCategory.findFirst({
      where: { wishlistId: input.wishlistId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = (lastCat?.sortOrder ?? -1) + 1;

    return prisma.wishlistCategory.create({
      data: {
        wishlistId: input.wishlistId,
        name: input.name,
        description: input.description ?? null,
        externalLink: input.externalLink ?? null,
        externalLinkLabel: input.externalLinkLabel ?? null,
        notes: input.notes ?? null,
        icon: input.icon ?? null,
        sortOrder,
      },
    });
  },

  /**
   * Find or create a category by name within a wishlist.
   */
  async findOrCreateCategory(wishlistId: string, name: string): Promise<WishlistCategory> {
    const existing = await prisma.wishlistCategory.findFirst({
      where: { wishlistId, name },
    });
    if (existing) return existing;
    return this.createCategory({ wishlistId, name });
  },

  /**
   * Get all categories for a wishlist.
   */
  async listCategories(wishlistId: string): Promise<WishlistCategory[]> {
    return prisma.wishlistCategory.findMany({
      where: { wishlistId },
      orderBy: { sortOrder: 'asc' },
    });
  },

  /**
   * Update a category.
   */
  async updateCategory(
    categoryId: string,
    data: Partial<{
      name: string;
      description: string | null;
      externalLink: string | null;
      externalLinkLabel: string | null;
      notes: string | null;
      icon: string | null;
    }>
  ): Promise<WishlistCategory> {
    return prisma.wishlistCategory.update({
      where: { id: categoryId },
      data,
    });
  },
};
