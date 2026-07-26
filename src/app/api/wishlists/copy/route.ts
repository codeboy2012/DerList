/**
 * POST /api/wishlists/copy
 *
 * Copy an entire wishlist (items, categories, metadata) into the current user's account.
 * Does NOT require ownership of the source wishlist (supports future public copy).
 * Uses a database transaction for atomicity.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    sourceWishlistId?: string;
    name?: string;
    copyItems?: boolean;
    copyCategories?: boolean;
    copyNotes?: boolean;
    copyPriorities?: boolean;
    copyTags?: boolean;
    copyMetadata?: boolean;
    copyPurchasedStatus?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { sourceWishlistId } = body;
  if (!sourceWishlistId) {
    return NextResponse.json({ error: 'sourceWishlistId is required' }, { status: 400 });
  }

  // Load source wishlist with items and categories
  const source = await prisma.wishlist.findUnique({
    where: { id: sourceWishlistId },
    include: {
      items: { orderBy: { position: 'asc' } },
      categories: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!source) {
    return NextResponse.json({ error: 'Source wishlist not found' }, { status: 404 });
  }

  // Authorization: allow if user owns it OR it's public
  if (source.ownerId !== user.id && source.visibility === 'PRIVATE') {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }

  // Options (all default to true)
  const opts = {
    copyItems: body.copyItems !== false,
    copyCategories: body.copyCategories !== false,
    copyNotes: body.copyNotes !== false,
    copyPriorities: body.copyPriorities !== false,
    copyTags: body.copyTags !== false,
    copyMetadata: body.copyMetadata !== false,
    copyPurchasedStatus: body.copyPurchasedStatus === true, // opt-in
  };

  const newTitle = body.name?.trim() || `${source.title} (Copy)`;
  const slug = await generateUniqueSlug(user.id, newTitle);

  try {
    // Run everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the new wishlist
      const newWishlist = await tx.wishlist.create({
        data: {
          ownerId: user.id,
          title: newTitle,
          description: source.description,
          visibility: 'PRIVATE',
          icon: source.icon,
          color: source.color,
          slug,
          notice: source.notice,
        },
      });

      // 2. Copy categories (build a map of old ID → new ID for item assignment)
      const categoryMap = new Map<string, string>();
      if (opts.copyCategories && source.categories.length > 0) {
        for (const cat of source.categories) {
          const newCat = await tx.wishlistCategory.create({
            data: {
              wishlistId: newWishlist.id,
              name: cat.name,
              description: cat.description,
              externalLink: cat.externalLink,
              externalLinkLabel: cat.externalLinkLabel,
              notes: opts.copyNotes ? cat.notes : null,
              sortOrder: cat.sortOrder,
              icon: cat.icon,
            },
          });
          categoryMap.set(cat.id, newCat.id);
        }
      }

      // 3. Copy items
      if (opts.copyItems && source.items.length > 0) {
        const itemsData = source.items.map((item) => ({
          wishlistId: newWishlist.id,
          title: item.title,
          description: item.description,
          url: item.url,
          image: item.image,
          brand: item.brand,
          retailer: item.retailer,
          currentPrice: item.currentPrice,
          currency: item.currency,
          originalPrice: item.originalPrice,
          dealInfo: item.dealInfo,
          priority: opts.copyPriorities ? item.priority : 'MEDIUM',
          starPriority: opts.copyPriorities ? item.starPriority : 1,
          quantity: item.quantity,
          purchased: opts.copyPurchasedStatus ? item.purchased : false,
          purchasedAt: opts.copyPurchasedStatus ? item.purchasedAt : null,
          notes: opts.copyNotes ? item.notes : null,
          category: item.category,
          position: item.position,
          productId: item.productId,
          wishlistCategoryId: item.wishlistCategoryId
            ? categoryMap.get(item.wishlistCategoryId) || null
            : null,
          metadata: opts.copyMetadata ? item.metadata : null,
        }));

        await tx.wishlistItem.createMany({ data: itemsData });
      }

      return newWishlist;
    });

    return NextResponse.json({
      success: true,
      wishlist: {
        id: result.id,
        title: result.title,
        slug: result.slug,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Copy failed' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function generateUniqueSlug(userId: string, title: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'wishlist';

  let slug = base;
  let attempt = 0;

  while (true) {
    const exists = await prisma.wishlist.findUnique({
      where: { ownerId_slug: { ownerId: userId, slug } },
      select: { id: true },
    });
    if (!exists) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}
