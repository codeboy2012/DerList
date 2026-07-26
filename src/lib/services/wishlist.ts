/**
 * Wishlist Service
 *
 * Business logic for wishlist operations.
 * Wraps WishlistRepository with authorization checks and business rules.
 */

import type { WishlistCategory, WishlistItem } from '@prisma/client';
import {
  ProductRepository,
  WishlistRepository,
  type WishlistItemCreateInput,
  type WishlistItemUpdateInput,
} from '@/lib/repositories';
import type { ProductDraft } from './product';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AddItemFromDraftOptions {
  wishlistId: string;
  userId: string;
  draft: ProductDraft;
  /** If true, also create/link a Product record */
  linkProduct?: boolean;
  /** Category to assign the item to */
  category?: string;
  /** Priority level */
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class WishlistService {
  /**
   * Get all wishlists for a user.
   */
  async listWishlists(userId: string) {
    return WishlistRepository.listByUser(userId);
  }

  /**
   * Get a wishlist with all items, verifying ownership.
   */
  async getWishlist(wishlistId: string, userId: string) {
    return WishlistRepository.findWithItems(wishlistId, userId);
  }

  /**
   * Add an item from a ProductDraft.
   * This is the main entry point after the universal import pipeline.
   * Optionally creates a linked Product record for price tracking.
   */
  async addItemFromDraft(options: AddItemFromDraftOptions): Promise<WishlistItem> {
    const { wishlistId, userId, draft, linkProduct, category, priority } = options;

    // Verify ownership
    const isOwner = await WishlistRepository.verifyOwnership(wishlistId, userId);
    if (!isOwner) {
      throw new Error('Wishlist not found or access denied.');
    }

    // Optionally create/link a Product record
    let productId: string | undefined;
    if (linkProduct && draft.url) {
      const product = await ProductRepository.upsertByUrl({
        canonicalUrl: draft.url,
        title: draft.title,
        description: draft.description,
        brand: draft.brand,
        retailer: draft.retailer,
        image: draft.image,
        currentPrice: draft.currentPrice,
        currency: draft.currency ?? 'USD',
        sku: draft.sku,
        mpn: draft.mpn,
        gtin: draft.gtin,
        asin: draft.asin,
        upc: draft.upc,
      });
      productId = product.id;
    }

    const input: WishlistItemCreateInput = {
      wishlistId,
      title: draft.title,
      description: draft.description,
      url: draft.url,
      image: draft.image,
      brand: draft.brand,
      retailer: draft.retailer,
      currentPrice: draft.currentPrice,
      originalPrice: draft.originalPrice,
      currency: draft.currency ?? 'USD',
      dealInfo: draft.dealInfo,
      category: category ?? draft.category,
      priority: priority ?? 'MEDIUM',
      productId,
    };

    return WishlistRepository.addItem(input);
  }

  /**
   * Add multiple items from drafts (batch import, e.g. PCPartPicker).
   * Optionally creates a category for the batch.
   */
  async addItemsFromDrafts(
    wishlistId: string,
    userId: string,
    drafts: ProductDraft[],
    options?: {
      categoryName?: string;
      categoryDescription?: string;
      categoryLink?: string;
      categoryNotes?: string;
    }
  ): Promise<{ itemsCreated: number; categoryId?: string }> {
    // Verify ownership
    const isOwner = await WishlistRepository.verifyOwnership(wishlistId, userId);
    if (!isOwner) {
      throw new Error('Wishlist not found or access denied.');
    }

    // Create category if specified
    let categoryId: string | undefined;
    if (options?.categoryName) {
      const category = await WishlistRepository.createCategory({
        wishlistId,
        name: options.categoryName,
        description: options.categoryDescription,
        externalLink: options.categoryLink,
        notes: options.categoryNotes,
      });
      categoryId = category.id;
    }

    // Convert drafts to item inputs
    const items = drafts.map((draft) => ({
      title: draft.title,
      description: draft.description,
      url: draft.url,
      image: draft.image,
      brand: draft.brand,
      retailer: draft.retailer,
      currentPrice: draft.currentPrice,
      originalPrice: draft.originalPrice,
      currency: draft.currency ?? 'USD',
      dealInfo: draft.dealInfo,
      category: draft.category,
      wishlistCategoryId: categoryId,
    }));

    const count = await WishlistRepository.addItems(wishlistId, items);

    return { itemsCreated: count, categoryId };
  }

  /**
   * Update a wishlist item (with ownership check).
   */
  async updateItem(
    itemId: string,
    wishlistId: string,
    userId: string,
    data: WishlistItemUpdateInput
  ): Promise<WishlistItem> {
    const isOwner = await WishlistRepository.verifyOwnership(wishlistId, userId);
    if (!isOwner) {
      throw new Error('Wishlist not found or access denied.');
    }

    return WishlistRepository.updateItem(itemId, data);
  }

  /**
   * Delete a wishlist item (with ownership check).
   */
  async deleteItem(itemId: string, wishlistId: string, userId: string): Promise<void> {
    const isOwner = await WishlistRepository.verifyOwnership(wishlistId, userId);
    if (!isOwner) {
      throw new Error('Wishlist not found or access denied.');
    }

    await WishlistRepository.deleteItem(itemId);
  }

  /**
   * Toggle the purchased status of an item.
   */
  async togglePurchased(itemId: string, wishlistId: string, userId: string): Promise<WishlistItem> {
    const isOwner = await WishlistRepository.verifyOwnership(wishlistId, userId);
    if (!isOwner) {
      throw new Error('Wishlist not found or access denied.');
    }

    const item = await WishlistRepository.findItem(itemId);
    if (!item) {
      throw new Error('Item not found.');
    }

    return WishlistRepository.updateItem(itemId, { purchased: !item.purchased });
  }

  /**
   * Create or find a category within a wishlist.
   */
  async ensureCategory(
    wishlistId: string,
    userId: string,
    name: string
  ): Promise<WishlistCategory> {
    const isOwner = await WishlistRepository.verifyOwnership(wishlistId, userId);
    if (!isOwner) {
      throw new Error('Wishlist not found or access denied.');
    }

    return WishlistRepository.findOrCreateCategory(wishlistId, name);
  }
}
