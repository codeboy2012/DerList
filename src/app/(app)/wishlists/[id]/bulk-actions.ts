'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import {
  BULK_MAX_ITEMS,
  BULK_OPERATIONS,
  runBulkAction,
  type BulkActionResult,
} from '@/lib/services/wishlist-bulk';

export type BulkActionState = BulkActionResult;

const initialFailure: BulkActionResult = {
  success: false,
  operation: 'archive',
  requested: 0,
  updated: 0,
  skipped: 0,
};

const bulkSchema = z.object({
  wishlistId: z.string().min(1),
  itemIds: z.array(z.string().min(1)).min(1).max(BULK_MAX_ITEMS),
  operation: z.enum(BULK_OPERATIONS),
  targetCollectionId: z.string().min(1).optional(),
  category: z.string().max(100).optional(),
  starPriority: z.coerce.number().int().min(1).max(4).optional(),
  // Only `active` and `archived` are accepted. The delete branch below also
  // requires the field, so a crafted call cannot widen its scope by omitting it.
  mode: z.enum(['active', 'archived']).optional(),
});

function revalidateWishlist(wishlistId: string) {
  revalidatePath(`/wishlists/${wishlistId}`);
  revalidatePath(`/wishlists/${wishlistId}/archive`);
  revalidatePath('/wishlists');
  revalidatePath('/dashboard');
}

/**
 * Run a bulk operation on products in a collection.
 *
 * The submitted ids are never trusted on their own: every operation is scoped
 * to the collection and its owner inside the service. Unauthorized ids are
 * reported as skipped rather than failing the whole operation.
 */
export async function bulkItemAction(
  _prevState: BulkActionState,
  formData: FormData
): Promise<BulkActionState> {
  const user = await requireUser();

  let itemIds: unknown;
  try {
    itemIds = JSON.parse(String(formData.get('itemIds') ?? '[]'));
  } catch {
    return { ...initialFailure, error: 'Invalid selection.' };
  }

  if (Array.isArray(itemIds) && itemIds.length > BULK_MAX_ITEMS) {
    return {
      ...initialFailure,
      error: `Select up to ${BULK_MAX_ITEMS} products at a time.`,
    };
  }

  const parsed = bulkSchema.safeParse({
    wishlistId: formData.get('wishlistId'),
    itemIds,
    operation: formData.get('operation'),
    targetCollectionId: formData.get('targetCollectionId') || undefined,
    category: formData.get('category') ?? undefined,
    starPriority: formData.get('starPriority') || undefined,
    mode: formData.get('mode') || undefined,
  });

  if (!parsed.success) {
    return { ...initialFailure, error: 'Invalid bulk action.' };
  }

  if (parsed.data.operation === 'delete' && !parsed.data.mode) {
    return {
      ...initialFailure,
      operation: 'delete',
      error: 'Choose whether to delete active or archived products.',
    };
  }

  const result = await runBulkAction({ userId: user.id, ...parsed.data });
  revalidateWishlist(parsed.data.wishlistId);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-item actions used by the product row and the archive view.
// ─────────────────────────────────────────────────────────────────────────────

async function runSingleItemAction(
  formData: FormData,
  operation: 'archive' | 'restore' | 'delete'
) {
  const user = await requireUser();
  const itemId = String(formData.get('itemId') ?? '');
  const wishlistId = String(formData.get('wishlistId') ?? '');

  if (!itemId || !wishlistId) return;

  await runBulkAction({
    userId: user.id,
    wishlistId,
    itemIds: [itemId],
    operation,
    // Permanent deletion is only available from the archive view, so a
    // single-item delete must target an archived product.
    mode: operation === 'delete' ? 'archived' : undefined,
  });

  revalidateWishlist(wishlistId);
}

export async function archiveItemAction(formData: FormData): Promise<void> {
  await runSingleItemAction(formData, 'archive');
}

export async function restoreItemAction(formData: FormData): Promise<void> {
  await runSingleItemAction(formData, 'restore');
}

export async function deleteArchivedItemAction(formData: FormData): Promise<void> {
  await runSingleItemAction(formData, 'delete');
}
