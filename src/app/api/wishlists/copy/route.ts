/**
 * POST /api/wishlists/copy
 *
 * Copy an entire wishlist (items, categories, metadata) into the current user's account.
 *
 * This shares its behaviour with `duplicateWishlistAction`: every item field is
 * preserved, categories are remapped to the new collection, and archived
 * products stay behind in the source. Collections are private, so the source
 * lookup is owner-scoped before any copy work begins.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface CopyBody {
  sourceWishlistId?: string;
  name?: string;
  copyItems?: boolean;
  copyCategories?: boolean;
  copyNotes?: boolean;
  copyPriorities?: boolean;
  copyTags?: boolean;
  copyMetadata?: boolean;
  copyPurchasedStatus?: boolean;
}

/** Tag-like keys that live inside the item metadata blob. */
const TAG_KEYS = ['tags', 'aiTags', 'customLabels'] as const;

function parseMetadataObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Build the copied metadata blob.
 *
 * `copyMetadata` controls specs, sellers, AI data and the rest of the blob.
 * `copyTags` independently controls the tag-like keys, so turning tags off
 * never drops the specifications and turning metadata off can still keep tags.
 */
function copyItemMetadata(
  raw: string | null,
  copyMetadata: boolean,
  copyTags: boolean
): string | null {
  if (!raw) return null;

  const parsed = parseMetadataObject(raw);
  if (!parsed) return copyMetadata ? raw : null;
  if (copyMetadata && copyTags) return raw;

  const next: Record<string, unknown> = copyMetadata ? { ...parsed } : {};
  for (const key of TAG_KEYS) {
    if (copyTags && key in parsed) next[key] = parsed[key];
    if (!copyTags) delete next[key];
  }

  return Object.keys(next).length > 0 ? JSON.stringify(next) : null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: CopyBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { sourceWishlistId } = body;
  if (!sourceWishlistId) {
    return NextResponse.json({ error: 'sourceWishlistId is required' }, { status: 400 });
  }

  // Load the source only when it belongs to the caller. A foreign id is
  // reported exactly like a missing row so it cannot be probed.
  const source = await prisma.wishlist.findFirst({
    where: { id: sourceWishlistId, ownerId: user.id },
    include: {
      // Archived products stay in the source collection; a copy represents the
      // normal view of the collection.
      items: { where: { archived: false }, orderBy: { position: 'asc' } },
      categories: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!source) {
    return NextResponse.json({ error: 'Source wishlist not found' }, { status: 404 });
  }

  // Options (all default to true, purchased status is opt-in)
  const opts = {
    copyItems: body.copyItems !== false,
    copyCategories: body.copyCategories !== false,
    copyNotes: body.copyNotes !== false,
    copyPriorities: body.copyPriorities !== false,
    copyTags: body.copyTags !== false,
    copyMetadata: body.copyMetadata !== false,
    copyPurchasedStatus: body.copyPurchasedStatus === true,
  };

  const newTitle = body.name?.trim().slice(0, 200) || `${source.title} (Copy)`;
  const slug = await generateUniqueSlug(user.id, newTitle);

  try {
    const result = await prisma.$transaction(async (tx) => {
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

      // Copy categories first and keep a map of source id → new id, so items
      // can be relinked to the copy's own category records.
      const categoryMap = new Map<string, string>();
      if (opts.copyCategories) {
        for (const category of source.categories) {
          const newCategory = await tx.wishlistCategory.create({
            data: {
              wishlistId: newWishlist.id,
              name: category.name,
              description: category.description,
              externalLink: category.externalLink,
              externalLinkLabel: category.externalLinkLabel,
              notes: opts.copyNotes ? category.notes : null,
              sortOrder: category.sortOrder,
              icon: category.icon,
            },
          });
          categoryMap.set(category.id, newCategory.id);
        }
      }

      if (opts.copyItems) {
        // createMany keeps the copy fast while still creating independent item
        // and category rows; only the shared Product record may be referenced.
        await tx.wishlistItem.createMany({
          data: source.items.map((item) => ({
            wishlistId: newWishlist.id,
            title: item.title,
            description: item.description,
            url: item.url,
            image: item.image,
            brand: item.brand,
            model: item.model,
            condition: item.condition,
            retailer: item.retailer,
            currentPrice: item.currentPrice,
            targetPrice: item.targetPrice,
            originalPrice: item.originalPrice,
            dealInfo: item.dealInfo,
            currency: item.currency,
            priority: opts.copyPriorities ? item.priority : 'MEDIUM',
            starPriority: opts.copyPriorities ? item.starPriority : 1,
            quantity: item.quantity,
            availability: item.availability,
            purchased: opts.copyPurchasedStatus ? item.purchased : false,
            purchasedAt: opts.copyPurchasedStatus ? item.purchasedAt : null,
            notes: opts.copyNotes ? item.notes : null,
            category: item.category,
            position: item.position,
            productId: item.productId,
            wishlistCategoryId:
              opts.copyCategories && item.wishlistCategoryId
                ? (categoryMap.get(item.wishlistCategoryId) ?? null)
                : null,
            metadata: copyItemMetadata(item.metadata, opts.copyMetadata, opts.copyTags),
          })),
        });
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
  } catch {
    // Do not forward database errors (or their details) to the browser.
    return NextResponse.json(
      { success: false, error: 'Could not copy this collection. Try again.' },
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
