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
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'wishlist';
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
  formData: FormData,
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

  const { title, description, visibility, icon, color } = parsed.data;
  const slug = await uniqueSlug(user.id, generateSlug(title));

  const wishlist = await prisma.wishlist.create({
    data: {
      ownerId: user.id,
      title,
      description: description || null,
      visibility,
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
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const wishlistId = formData.get('wishlistId') as string;

  const wishlist = await prisma.wishlist.findUnique({
    where: { id: wishlistId },
    select: { id: true, ownerId: true, slug: true },
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
    archived: formData.get('archived') === 'true',
  };

  const parsed = updateWishlistSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { title, description, visibility, icon, color, archived } = parsed.data;

  // Regenerate slug if title changed
  const newSlug = await uniqueSlug(user.id, generateSlug(title));
  const slugToUse = wishlist.slug === generateSlug(title) ? wishlist.slug : newSlug;

  await prisma.wishlist.update({
    where: { id: wishlistId },
    data: {
      title,
      description: description || null,
      visibility,
      icon: icon || null,
      color: color || null,
      slug: slugToUse,
      archived: archived ?? false,
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
    include: { items: true },
  });

  if (!source || source.ownerId !== user.id) return;

  const slug = await uniqueSlug(user.id, generateSlug(`${source.title} Copy`));

  await prisma.wishlist.create({
    data: {
      ownerId: user.id,
      title: `${source.title} (Copy)`,
      description: source.description,
      visibility: 'PRIVATE',
      icon: source.icon,
      color: source.color,
      slug,
      items: {
        create: source.items.map((item) => ({
          title: item.title,
          description: item.description,
          url: item.url,
          image: item.image,
          brand: item.brand,
          retailer: item.retailer,
          currentPrice: item.currentPrice,
          currency: item.currency,
          priority: item.priority,
          quantity: item.quantity,
          notes: item.notes,
          position: item.position,
        })),
      },
    },
  });

  revalidatePath('/wishlists');
  revalidatePath('/dashboard');
  redirect('/wishlists');
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
  revalidatePath('/dashboard');
}
