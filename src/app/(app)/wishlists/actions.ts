'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createWishlistSchema, updateWishlistSchema } from '@/lib/validations/wishlist';
import type { ActionState } from '../../(auth)/actions';

// ─────────────────────────────────────────────────────────────────────────────
// Slug generation
// ─────────────────────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'wishlist'
  );
}

async function uniqueSlug(ownerId: string, base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await prisma.wishlist.findUnique({
      where: { ownerId_slug: { ownerId, slug } },
      select: { id: true },
    });
    if (!existing) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Wishlist
// ─────────────────────────────────────────────────────────────────────────────

export async function createWishlistAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    visibility: formData.get('visibility'),
    icon: formData.get('icon'),
    color: formData.get('color'),
  };

  const parsed = createWishlistSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { title, description, icon, color } = parsed.data;
  const slug = await uniqueSlug(user.id, generateSlug(title));

  // DerList is a private personal wishlist: collections are never shared.
  const wishlist = await prisma.wishlist.create({
    data: {
      ownerId: user.id,
      title,
      description: description || null,
      visibility: 'PRIVATE',
      icon: icon || null,
      color: color || null,
      slug,
    },
  });

  revalidatePath('/wishlists');
  revalidatePath('/dashboard');
  redirect(`/wishlists/${wishlist.id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Update Wishlist
// ─────────────────────────────────────────────────────────────────────────────

export async function updateWishlistAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const wishlistId = formData.get('wishlistId') as string;

  const wishlist = await prisma.wishlist.findUnique({
    where: { id: wishlistId },
    select: { id: true, ownerId: true, slug: true, archived: true },
  });

  if (!wishlist || wishlist.ownerId !== user.id) {
    return { success: false, error: 'Wishlist not found.' };
  }

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    visibility: formData.get('visibility'),
    icon: formData.get('icon'),
    color: formData.get('color'),
    // Preserve the stored state when the form does not submit the field at all.
    archived: formData.has('archived') ? formData.get('archived') : undefined,
  };

  const parsed = updateWishlistSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { title, description, icon, color, archived } = parsed.data;

  // Regenerate slug if title changed
  const newSlug = await uniqueSlug(user.id, generateSlug(title));
  const slugToUse = wishlist.slug === generateSlug(title) ? wishlist.slug : newSlug;

  await prisma.wishlist.update({
    where: { id: wishlistId },
    data: {
      title,
      description: description || null,
      visibility: 'PRIVATE',
      icon: icon || null,
      color: color || null,
      slug: slugToUse,
      // An absent value means "leave the current state alone"; the edit form
      // submits its existing state explicitly.
      archived: archived ?? wishlist.archived,
    },
  });

  revalidatePath(`/wishlists/${wishlistId}`);
  revalidatePath('/wishlists');
  revalidatePath('/dashboard');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Wishlist
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteWishlistAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const wishlistId = formData.get('wishlistId') as string;

  const wishlist = await prisma.wishlist.findUnique({
    where: { id: wishlistId },
    select: { ownerId: true },
  });

  if (!wishlist || wishlist.ownerId !== user.id) return;

  await prisma.wishlist.delete({ where: { id: wishlistId } });

  revalidatePath('/wishlists');
  revalidatePath('/dashboard');
  redirect('/wishlists');
}

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate Wishlist
// ─────────────────────────────────────────────────────────────────────────────

export async function duplicateWishlistAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const wishlistId = formData.get('wishlistId') as string;

  const source = await prisma.wishlist.findUnique({
    where: { id: wishlistId },
    include: {
      items: { where: { archived: false }, orderBy: { position: 'asc' } },
      categories: { orderBy: { sortOrder: 'asc' } },
    },
  });

  // Collections are private: a foreign id is treated as missing.
  if (!source || source.ownerId !== user.id) return;

  const slug = await uniqueSlug(user.id, generateSlug(`${source.title} Copy`));

  // A duplicate creates independent wishlist-item rows. Product records may be
  // shared, but ownership, notes, source URLs and metadata stay with the copy's
  // own item records.
  const copy = await prisma.$transaction(async (tx) => {
    const created = await tx.wishlist.create({
      data: {
        ownerId: user.id,
        title: `${source.title} (Copy)`,
        description: source.description,
        visibility: 'PRIVATE',
        icon: source.icon,
        color: source.color,
        notice: source.notice,
        slug,
      },
    });

    const categoryMap = new Map<string, string>();
    for (const category of source.categories) {
      const newCategory = await tx.wishlistCategory.create({
        data: {
          wishlistId: created.id,
          name: category.name,
          description: category.description,
          externalLink: category.externalLink,
          externalLinkLabel: category.externalLinkLabel,
          notes: category.notes,
          sortOrder: category.sortOrder,
          icon: category.icon,
        },
      });
      categoryMap.set(category.id, newCategory.id);
    }

    for (const item of source.items) {
      await tx.wishlistItem.create({
        data: {
          wishlistId: created.id,
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
          priority: item.priority,
          starPriority: item.starPriority,
          quantity: item.quantity,
          availability: item.availability,
          purchased: item.purchased,
          purchasedAt: item.purchasedAt,
          notes: item.notes,
          category: item.category,
          position: item.position,
          productId: item.productId,
          wishlistCategoryId: item.wishlistCategoryId
            ? (categoryMap.get(item.wishlistCategoryId) ?? null)
            : null,
          metadata: item.metadata,
        },
      });
    }

    return created;
  });

  revalidatePath('/wishlists');
  revalidatePath('/dashboard');
  redirect(`/wishlists/${copy.id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reorder Wishlists
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Move a wishlist one step up or down in the user's manual order.
 *
 * Ordering is normalised to unique positions on every move so it works even
 * for existing collections that all share the default `sortOrder` of 0.
 * Button-based, so it stays keyboard-accessible without drag-and-drop.
 */
export async function moveWishlistAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const wishlistId = formData.get('wishlistId') as string;
  const direction = formData.get('direction') === 'up' ? 'up' : 'down';

  // Reorder within the collection's own archive state. The active list and the
  // archived list are separate views, so an archived collection must never
  // consume a position that shows up in the active ordering (and vice versa).
  const wishlist = await prisma.wishlist.findFirst({
    where: { id: wishlistId, ownerId: user.id },
    select: { archived: true },
  });
  if (!wishlist) return;

  const ordered = await prisma.wishlist.findMany({
    where: { ownerId: user.id, archived: wishlist.archived },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    select: { id: true },
  });

  const index = ordered.findIndex((wishlist) => wishlist.id === wishlistId);
  if (index === -1) return;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) return;

  const reordered = [...ordered];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, moved);

  await prisma.$transaction(
    reordered.map((wishlist, position) =>
      prisma.wishlist.update({
        where: { id: wishlist.id },
        data: { sortOrder: position },
      })
    )
  );

  revalidatePath('/wishlists');
  revalidatePath('/dashboard');
}

// ─────────────────────────────────────────────────────────────────────────────
// Archive / Unarchive
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleArchiveAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const wishlistId = formData.get('wishlistId') as string;

  const wishlist = await prisma.wishlist.findUnique({
    where: { id: wishlistId },
    select: { ownerId: true, archived: true },
  });

  if (!wishlist || wishlist.ownerId !== user.id) return;

  await prisma.wishlist.update({
    where: { id: wishlistId },
    data: { archived: !wishlist.archived },
  });

  revalidatePath('/wishlists');
  revalidatePath(`/wishlists/${wishlistId}`);
  revalidatePath('/dashboard');
}
