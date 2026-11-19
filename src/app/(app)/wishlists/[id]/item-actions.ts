'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveCategoryId } from '@/lib/services/wishlist-categories';
import { createItemSchema } from '@/lib/validations/wishlist';
import { isItemCondition } from '@/lib/wishlist/conditions';
import type { ActionState } from '../../../(auth)/actions';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function verifyOwnership(wishlistId: string, userId: string) {
  if (!wishlistId) return false;
  const wl = await prisma.wishlist.findUnique({
    where: { id: wishlistId },
    select: { ownerId: true },
  });
  return wl?.ownerId === userId;
}

/**
 * Where-clause for an item that must belong to a specific collection owned by
 * the caller.
 *
 * Every item mutation is scoped with this instead of trusting the submitted
 * `itemId`: a valid `wishlistId` alone must never authorise an arbitrary item.
 * The ownership check and the write are therefore the same query, which also
 * removes the check/use race.
 */
function ownedItemWhere(itemId: string, wishlistId: string, userId: string) {
  return {
    id: itemId,
    wishlistId,
    wishlist: { ownerId: userId },
  };
}

/**
 * Load an item only when it belongs to the given collection *and* that
 * collection belongs to the caller.
 *
 * Returns null for a missing item, a foreign collection and a mismatched
 * item/collection pair alike, so callers cannot probe for records they do not
 * own.
 */
async function findOwnedItem(itemId: string, wishlistId: string, userId: string) {
  if (!itemId || !wishlistId) return null;
  return prisma.wishlistItem.findFirst({
    where: ownedItemWhere(itemId, wishlistId, userId),
    select: { id: true, purchased: true, archived: true },
  });
}

/** Archived products are read-only until they are restored. */
function archivedEditError() {
  return {
    success: false as const,
    error: 'Restore this archived product before editing it.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Item
// ─────────────────────────────────────────────────────────────────────────────

export async function addItemAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const wishlistId = formData.get('wishlistId') as string;

  if (!(await verifyOwnership(wishlistId, user.id))) {
    return { success: false, error: 'Wishlist not found.' };
  }

  // Fields omitted from the submitted form must be `undefined` (unknown), not
  // `null` — the schema treats an absent value as "not provided".
  const text = (key: string): string | undefined => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : undefined;
  };

  const raw = {
    title: text('title'),
    description: text('description'),
    url: text('url'),
    image: text('image'),
    brand: text('brand'),
    retailer: text('retailer'),
    currentPrice: text('currentPrice'),
    currency: text('currency') || 'USD',
    priority: text('priority') || 'MEDIUM',
    quantity: text('quantity') || '1',
    notes: text('notes'),
  };

  const parsed = createItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  // Personal fields are optional and only stored when the user supplied them.
  const conditionRaw = String(formData.get('condition') ?? '').trim();
  const condition = isItemCondition(conditionRaw) ? conditionRaw : null;

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
      model: optionalText(formData.get('model'), 100),
      category: optionalText(formData.get('category'), 100),
      condition,
      availability: optionalText(formData.get('availability'), 200),
      retailer: data.retailer || null,
      currentPrice: data.currentPrice ?? null,
      targetPrice: optionalNumber(formData.get('targetPrice')),
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
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const itemId = formData.get('itemId') as string;
  const wishlistId = formData.get('wishlistId') as string;

  if (!(await verifyOwnership(wishlistId, user.id))) {
    return { success: false, error: 'Item not found.' };
  }

  const existing = await findOwnedItem(itemId, wishlistId, user.id);
  if (!existing) {
    return { success: false, error: 'Item not found.' };
  }
  if (existing.archived) return archivedEditError();

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

  const updated = await prisma.wishlistItem.updateMany({
    where: ownedItemWhere(itemId, wishlistId, user.id),
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

  if (updated.count === 0) {
    return { success: false, error: 'Item not found.' };
  }

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

  // Scoped delete: the item must be in *this* collection, owned by the caller.
  // Archived products use the archive's confirmation flow instead, so an
  // active-view delete can never silently remove one.
  await prisma.wishlistItem.deleteMany({
    where: { ...ownedItemWhere(itemId, wishlistId, user.id), archived: false },
  });

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

  const item = await findOwnedItem(itemId, wishlistId, user.id);
  if (!item || item.archived) return;

  await prisma.wishlistItem.updateMany({
    where: ownedItemWhere(itemId, wishlistId, user.id),
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
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const itemId = formData.get('itemId') as string;
  const wishlistId = formData.get('wishlistId') as string;

  if (!(await verifyOwnership(wishlistId, user.id))) {
    return { success: false, error: 'Item not found.' };
  }

  const existing = await findOwnedItem(itemId, wishlistId, user.id);
  if (!existing) {
    return { success: false, error: 'Item not found.' };
  }
  if (existing.archived) return archivedEditError();

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
  const safeStarPriority =
    starPriority && starPriority >= 1 && starPriority <= 4 ? starPriority : undefined;

  // The free-text category and its relation are updated together so the two
  // can never disagree (or point at a category from another collection).
  const updated = await prisma.$transaction(async (tx) => {
    const wishlistCategoryId = await resolveCategoryId(tx, wishlistId, category);
    return tx.wishlistItem.updateMany({
      where: ownedItemWhere(itemId, wishlistId, user.id),
      data: {
        title,
        notes: notes || null,
        priority: safePriority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        quantity: safeQuantity,
        category,
        wishlistCategoryId,
        ...(safeStarPriority !== undefined && { starPriority: safeStarPriority }),
      },
    });
  });

  if (updated.count === 0) {
    return { success: false, error: 'Item not found.' };
  }

  revalidatePath(`/wishlists/${wishlistId}`);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Update Item Details (personal wishlist fields)
// ─────────────────────────────────────────────────────────────────────────────

function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

function optionalText(value: FormDataEntryValue | null, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Update the personal details of a saved product.
 *
 * Handles the fields that belong to the wishlist entry itself (condition,
 * target price, quantity, notes, collection) as opposed to the imported product
 * record. Moving an item to another collection only re-parents the wishlist
 * entry — the product record and all other wishlists that reference it are
 * untouched.
 */
export async function updateItemDetailsAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const itemId = String(formData.get('itemId') ?? '');
  const wishlistId = String(formData.get('wishlistId') ?? '');

  if (!(await verifyOwnership(wishlistId, user.id))) {
    return { success: false, error: 'Wishlist not found.' };
  }

  const item = await prisma.wishlistItem.findUnique({
    where: { id: itemId },
    select: { id: true, wishlistId: true, archived: true },
  });

  if (!item || item.wishlistId !== wishlistId) {
    return { success: false, error: 'Item not found.' };
  }
  if (item.archived) return archivedEditError();

  const title = String(formData.get('title') ?? '').trim();
  if (!title) {
    return { success: false, error: 'Product name is required.' };
  }

  const priorityRaw = String(formData.get('priority') ?? 'MEDIUM');
  const priority = (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).includes(
    priorityRaw as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  )
    ? (priorityRaw as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
    : 'MEDIUM';

  const quantityRaw = Number.parseInt(String(formData.get('quantity') ?? '1'), 10);
  const quantity = Number.isNaN(quantityRaw) ? 1 : Math.min(Math.max(quantityRaw, 1), 999);

  const conditionRaw = String(formData.get('condition') ?? '').trim();
  const condition = isItemCondition(conditionRaw) ? conditionRaw : null;

  const currencyRaw = String(formData.get('currency') ?? 'USD')
    .trim()
    .toUpperCase();
  const currency = /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : 'USD';

  // Optional move to another active collection owned by the same user.
  // Archived collections are rejected here as well as in the UI: their
  // contents are hidden from normal views.
  const targetCollectionId = String(formData.get('collectionId') ?? '').trim();
  let moveTo: string | null = null;
  if (targetCollectionId && targetCollectionId !== wishlistId) {
    const target = await prisma.wishlist.findFirst({
      where: { id: targetCollectionId, ownerId: user.id, archived: false },
      select: { id: true },
    });
    if (!target) {
      return { success: false, error: 'Collection not found or archived.' };
    }
    moveTo = target.id;
  }

  const categoryName = optionalText(formData.get('category'), 100);
  const destinationId = moveTo ?? wishlistId;

  const updated = await prisma.$transaction(async (tx) => {
    let position: number | undefined;
    if (moveTo) {
      const lastItem = await tx.wishlistItem.findFirst({
        where: { wishlistId: moveTo },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (lastItem?.position ?? -1) + 1;
    }

    // A category record belongs to its collection, so the relation is resolved
    // against the destination (or kept in the current collection on a normal
    // edit) rather than copied across from the source.
    const wishlistCategoryId = await resolveCategoryId(tx, destinationId, categoryName);

    return tx.wishlistItem.updateMany({
      where: ownedItemWhere(itemId, wishlistId, user.id),
      data: {
        title: title.slice(0, 200),
        description: optionalText(formData.get('description'), 1000),
        brand: optionalText(formData.get('brand'), 100),
        model: optionalText(formData.get('model'), 100),
        category: categoryName,
        wishlistCategoryId,
        condition,
        availability: optionalText(formData.get('availability'), 200),
        currentPrice: optionalNumber(formData.get('currentPrice')),
        targetPrice: optionalNumber(formData.get('targetPrice')),
        currency,
        quantity,
        priority,
        notes: optionalText(formData.get('notes'), 2000),
        ...(moveTo ? { wishlistId: moveTo, position } : {}),
      },
    });
  });

  if (updated.count === 0) {
    return { success: false, error: 'Item not found.' };
  }

  revalidatePath(`/wishlists/${wishlistId}`);
  if (moveTo) revalidatePath(`/wishlists/${moveTo}`);
  revalidatePath('/wishlists');
  revalidatePath('/dashboard');
  return { success: true };
}
