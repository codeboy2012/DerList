'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createItemSchema } from '@/lib/validations/wishlist';

import type { ActionState } from '../../../(auth)/actions';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function verifyOwnership(wishlistId: string, userId: string) {
  const wl = await prisma.wishlist.findUnique({
    where: { id: wishlistId },
    select: { ownerId: true },
  });
  return wl?.ownerId === userId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Item
// ─────────────────────────────────────────────────────────────────────────────

export async function addItemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const wishlistId = formData.get('wishlistId') as string;

  if (!(await verifyOwnership(wishlistId, user.id))) {
    return { success: false, error: 'Wishlist not found.' };
  }

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    url: formData.get('url'),
    image: formData.get('image'),
    brand: formData.get('brand'),
    retailer: formData.get('retailer'),
    currentPrice: formData.get('currentPrice'),
    currency: formData.get('currency') || 'USD',
    priority: formData.get('priority') || 'MEDIUM',
    quantity: formData.get('quantity') || '1',
    notes: formData.get('notes'),
  };

  const parsed = createItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

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
      title: data.title,
      description: data.description || null,
      url: data.url || null,
      image: data.image || null,
      brand: data.brand || null,
      retailer: data.retailer || null,
      currentPrice: data.currentPrice ?? null,
      currency: data.currency,
      priority: data.priority,
      quantity: data.quantity,
      notes: data.notes || null,
      position,
    },
  });

  revalidatePath(`/wishlists/${wishlistId}`);
  revalidatePath('/dashboard');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Update Item
// ─────────────────────────────────────────────────────────────────────────────

export async function updateItemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const itemId = formData.get('itemId') as string;
  const wishlistId = formData.get('wishlistId') as string;

  if (!(await verifyOwnership(wishlistId, user.id))) {
    return { success: false, error: 'Item not found.' };
  }

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    url: formData.get('url'),
    image: formData.get('image'),
    brand: formData.get('brand'),
    retailer: formData.get('retailer'),
    currentPrice: formData.get('currentPrice'),
    currency: formData.get('currency') || 'USD',
    priority: formData.get('priority') || 'MEDIUM',
    quantity: formData.get('quantity') || '1',
    notes: formData.get('notes'),
    purchased: formData.get('purchased') === 'true',
  };

  const parsed = createItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const purchased = raw.purchased;

  await prisma.wishlistItem.update({
    where: { id: itemId },
    data: {
      title: data.title,
      description: data.description || null,
      url: data.url || null,
      image: data.image || null,
      brand: data.brand || null,
      retailer: data.retailer || null,
      currentPrice: data.currentPrice ?? null,
      currency: data.currency,
      priority: data.priority,
      quantity: data.quantity,
      notes: data.notes || null,
      purchased,
      purchasedAt: purchased ? new Date() : null,
    },
  });

  revalidatePath(`/wishlists/${wishlistId}`);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Item
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteItemAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const itemId = formData.get('itemId') as string;
  const wishlistId = formData.get('wishlistId') as string;

  if (!(await verifyOwnership(wishlistId, user.id))) return;

  await prisma.wishlistItem.delete({ where: { id: itemId } });

  revalidatePath(`/wishlists/${wishlistId}`);
  revalidatePath('/dashboard');
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle Purchased
// ─────────────────────────────────────────────────────────────────────────────

export async function togglePurchasedAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const itemId = formData.get('itemId') as string;
  const wishlistId = formData.get('wishlistId') as string;

  if (!(await verifyOwnership(wishlistId, user.id))) return;

  const item = await prisma.wishlistItem.findUnique({
    where: { id: itemId },
    select: { purchased: true },
  });
  if (!item) return;

  await prisma.wishlistItem.update({
    where: { id: itemId },
    data: {
      purchased: !item.purchased,
      purchasedAt: !item.purchased ? new Date() : null,
    },
  });

  revalidatePath(`/wishlists/${wishlistId}`);
  revalidatePath('/dashboard');
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Edit Item (inline — notes, priority, quantity, title)
// ─────────────────────────────────────────────────────────────────────────────

export async function quickEditItemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const itemId = formData.get('itemId') as string;
  const wishlistId = formData.get('wishlistId') as string;

  if (!(await verifyOwnership(wishlistId, user.id))) {
    return { success: false, error: 'Item not found.' };
  }

  const title = (formData.get('title') as string)?.trim();
  const notes = formData.get('notes') as string | null;
  const priority = formData.get('priority') as string;
  const quantity = parseInt(formData.get('quantity') as string, 10);
  const starPriorityRaw = formData.get('starPriority');
  const starPriority = starPriorityRaw ? parseInt(starPriorityRaw as string, 10) : null;
  const category = (formData.get('category') as string | null)?.trim() || null;

  if (!title || title.length === 0) {
    return { success: false, error: 'Title is required.' };
  }

  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const safePriority = validPriorities.includes(priority) ? priority : 'MEDIUM';
  const safeQuantity = isNaN(quantity) || quantity < 1 ? 1 : Math.min(quantity, 999);
  const safeStarPriority = starPriority && starPriority >= 1 && starPriority <= 4 ? starPriority : undefined;

  await prisma.wishlistItem.update({
    where: { id: itemId },
    data: {
      title,
      notes: notes || null,
      priority: safePriority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      quantity: safeQuantity,
      category,
      ...(safeStarPriority !== undefined && { starPriority: safeStarPriority }),
    },
  });

  revalidatePath(`/wishlists/${wishlistId}`);
  return { success: true };
}
