/**
 * Bulk wishlist-item operations.
 *
 * Every operation is scoped by the collection *and* its owner, so a caller can
 * never mutate an item by submitting a foreign id. Ids that do not resolve to
 * an item in that collection are skipped and reported, which makes partial
 * failures visible instead of silently dropping work.
 */

import { prisma } from '@/lib/prisma';
import { matchCategoryId, resolveCategoryId } from '@/lib/services/wishlist-categories';

export const BULK_MAX_ITEMS = 500;

export const BULK_OPERATIONS = [
  'move',
  'category',
  'priority',
  'archive',
  'restore',
  'delete',
] as const;

export type BulkOperation = (typeof BULK_OPERATIONS)[number];

export interface BulkActionInput {
  userId: string;
  /** Collection the selected items must belong to. */
  wishlistId: string;
  itemIds: string[];
  operation: BulkOperation;
  /** Destination collection for `move`. */
  targetCollectionId?: string;
  /** Category name for `category`; an empty string clears the category. */
  category?: string;
  /** 1–4 star priority for `priority`. */
  starPriority?: number;
  /**
   * Where a delete originated. Deletion requires an explicit state: active bulk
   * actions can never permanently delete archived products (and the archive
   * view can never delete active ones). Other operations ignore it.
   */
  mode?: 'active' | 'archived';
}

export interface BulkActionResult {
  success: boolean;
  operation: BulkOperation;
  /** Number of ids submitted (after de-duplication and the safety cap). */
  requested: number;
  updated: number;
  skipped: number;
  message?: string;
  error?: string;
}

const PRIORITY_BY_STAR = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function uniqueIds(itemIds: string[]): string[] {
  return [
    ...new Set(
      itemIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    ),
  ].slice(0, BULK_MAX_ITEMS);
}

/**
 * Ownership-scoped item filter. Every bulk mutation uses this instead of
 * trusting the submitted ids on their own.
 */
function itemScope(userId: string, wishlistId: string, itemIds: string[], archived: boolean) {
  return {
    id: { in: itemIds },
    wishlistId,
    wishlist: { ownerId: userId },
    archived,
  };
}

function buildResult(
  operation: BulkOperation,
  requested: number,
  updated: number,
  successMessage: string,
  failureMessage: string
): BulkActionResult {
  const skipped = Math.max(requested - updated, 0);
  const skippedNote =
    skipped > 0 ? ` ${skipped} skipped — missing, already handled, or not in this collection.` : '';

  return {
    success: true,
    operation,
    requested,
    updated,
    skipped,
    message: `${updated > 0 ? successMessage : failureMessage}${skippedNote}`,
  };
}

export async function runBulkAction(input: BulkActionInput): Promise<BulkActionResult> {
  const itemIds = uniqueIds(input.itemIds);
  const requested = itemIds.length;

  if (requested === 0) {
    return {
      success: false,
      operation: input.operation,
      requested: 0,
      updated: 0,
      skipped: 0,
      error: 'Select at least one product first.',
    };
  }

  const wishlist = await prisma.wishlist.findFirst({
    where: { id: input.wishlistId, ownerId: input.userId },
    select: { id: true, title: true },
  });

  if (!wishlist) {
    return {
      success: false,
      operation: input.operation,
      requested,
      updated: 0,
      skipped: 0,
      error: 'Wishlist not found.',
    };
  }

  switch (input.operation) {
    case 'move': {
      const targetId = input.targetCollectionId?.trim();
      if (!targetId) {
        return {
          success: false,
          operation: 'move',
          requested,
          updated: 0,
          skipped: 0,
          error: 'Choose a collection to move the products into.',
        };
      }
      if (targetId === wishlist.id) {
        return {
          success: false,
          operation: 'move',
          requested,
          updated: 0,
          skipped: 0,
          error: 'The products are already in this collection.',
        };
      }

      // Archived collections are not a valid destination: their contents are
      // hidden from normal views, so a move into one would silently lose the
      // product. Scope by owner *and* active state in the same query.
      const target = await prisma.wishlist.findFirst({
        where: { id: targetId, ownerId: input.userId, archived: false },
        select: { id: true, title: true },
      });
      if (!target) {
        return {
          success: false,
          operation: 'move',
          requested,
          updated: 0,
          skipped: 0,
          error: 'Collection not found or archived.',
        };
      }

      const updated = await prisma.$transaction(
        async (tx) => {
          const items = await tx.wishlistItem.findMany({
            where: itemScope(input.userId, wishlist.id, itemIds, false),
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, category: true },
          });
          if (items.length === 0) return 0;

          const last = await tx.wishlistItem.findFirst({
            where: { wishlistId: target.id },
            orderBy: { position: 'desc' },
            select: { position: true },
          });
          let position = (last?.position ?? -1) + 1;

          for (const item of items) {
            // Category records belong to a collection, so re-link to the same
            // category name in the destination when one exists. Never keep a
            // relation to a category in the source collection.
            await tx.wishlistItem.update({
              where: { id: item.id },
              data: {
                wishlistId: target.id,
                position: position++,
                wishlistCategoryId: await matchCategoryId(tx, target.id, item.category),
              },
            });
          }

          return items.length;
        },
        { timeout: 20_000 }
      );

      return buildResult(
        'move',
        requested,
        updated,
        `Moved ${updated} ${updated === 1 ? 'product' : 'products'} to “${target.title}”.`,
        'No products were moved.'
      );
    }

    case 'category': {
      const name = (input.category ?? '').trim().slice(0, 100);

      const updated = await prisma.$transaction(async (tx) => {
        // Resolve ownership before creating anything, so a selection made up
        // entirely of foreign ids cannot leave an empty category behind.
        const ownedItems = await tx.wishlistItem.findMany({
          where: itemScope(input.userId, wishlist.id, itemIds, false),
          select: { id: true },
        });
        if (ownedItems.length === 0) return 0;

        const categoryId = await resolveCategoryId(tx, wishlist.id, name);

        const result = await tx.wishlistItem.updateMany({
          where: itemScope(input.userId, wishlist.id, itemIds, false),
          data: { category: name || null, wishlistCategoryId: categoryId },
        });
        return result.count;
      });

      return buildResult(
        'category',
        requested,
        updated,
        `Updated the category for ${updated} ${updated === 1 ? 'product' : 'products'}.`,
        'No categories were changed.'
      );
    }

    case 'priority': {
      const star = Number(input.starPriority);
      if (!Number.isInteger(star) || star < 1 || star > 4) {
        return {
          success: false,
          operation: 'priority',
          requested,
          updated: 0,
          skipped: 0,
          error: 'Priority must be between 1 and 4.',
        };
      }

      const { count } = await prisma.wishlistItem.updateMany({
        where: itemScope(input.userId, wishlist.id, itemIds, false),
        data: { starPriority: star, priority: PRIORITY_BY_STAR[star - 1] },
      });

      return buildResult(
        'priority',
        requested,
        count,
        `Updated the priority of ${count} ${count === 1 ? 'product' : 'products'}.`,
        'No priorities were changed.'
      );
    }

    case 'archive': {
      const { count } = await prisma.wishlistItem.updateMany({
        where: itemScope(input.userId, wishlist.id, itemIds, false),
        data: { archived: true, archivedAt: new Date() },
      });

      return buildResult(
        'archive',
        requested,
        count,
        `Archived ${count} ${count === 1 ? 'product' : 'products'}.`,
        'No products were archived.'
      );
    }

    case 'restore': {
      const { count } = await prisma.wishlistItem.updateMany({
        where: itemScope(input.userId, wishlist.id, itemIds, true),
        data: { archived: false, archivedAt: null },
      });

      return buildResult(
        'restore',
        requested,
        count,
        `Restored ${count} ${count === 1 ? 'product' : 'products'}.`,
        'No products were restored.'
      );
    }

    case 'delete': {
      // Deletion must state which archive state it targets. An omitted,
      // malformed or unexpected value would otherwise widen the scope to every
      // selected product, so the service refuses rather than guessing. The
      // ownership/collection scope is still part of the same predicate.
      const mode = input.mode;
      if (mode !== 'active' && mode !== 'archived') {
        return {
          success: false,
          operation: 'delete',
          requested,
          updated: 0,
          skipped: 0,
          error: 'Choose whether to delete active or archived products.',
        };
      }

      const { count } = await prisma.wishlistItem.deleteMany({
        where: {
          id: { in: itemIds },
          wishlistId: wishlist.id,
          wishlist: { ownerId: input.userId },
          archived: mode === 'archived',
        },
      });

      return buildResult(
        'delete',
        requested,
        count,
        `Deleted ${count} ${count === 1 ? 'product' : 'products'}.`,
        'No products were deleted.'
      );
    }

    default: {
      return {
        success: false,
        operation: input.operation,
        requested,
        updated: 0,
        skipped: 0,
        error: 'Unsupported bulk action.',
      };
    }
  }
}
