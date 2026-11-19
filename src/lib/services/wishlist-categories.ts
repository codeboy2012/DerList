/**
 * Category-relation helpers.
 *
 * A wishlist item stores both a free-text `category` and an optional
 * `wishlistCategoryId` relation. The relation must always point at a category
 * that belongs to the item's own collection; these helpers are the single
 * place that resolves/creates that relation so every mutation path stays
 * consistent.
 */

import type { Prisma } from '@prisma/client';

export type CategoryClient = Pick<Prisma.TransactionClient, 'wishlistCategory'>;

/** Trim a submitted category name to the stored column limit. */
export function normalizeCategoryName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 100);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve a category record in `wishlistId` for `name`, creating it when it
 * does not exist yet. Returns `null` for an empty name (an uncategorized item)
 * so callers can clear the relation at the same time.
 */
export async function resolveCategoryId(
  client: CategoryClient,
  wishlistId: string,
  name: unknown
): Promise<string | null> {
  const normalized = normalizeCategoryName(name);
  if (!normalized) return null;

  const exact = await client.wishlistCategory.findUnique({
    where: { wishlistId_name: { wishlistId, name: normalized } },
    select: { id: true },
  });
  if (exact) return exact.id;

  // Names are unique per collection, but historically the UI allowed
  // differently-cased duplicates. Reuse an existing record rather than
  // creating a second one that only differs by case.
  const caseInsensitive = await client.wishlistCategory.findFirst({
    where: { wishlistId, name: { equals: normalized, mode: 'insensitive' } },
    select: { id: true },
  });
  if (caseInsensitive) return caseInsensitive.id;

  try {
    const created = await client.wishlistCategory.create({
      data: { wishlistId, name: normalized },
      select: { id: true },
    });
    return created.id;
  } catch {
    // A concurrent create won the race; use that row.
    const existing = await client.wishlistCategory.findFirst({
      where: { wishlistId, name: { equals: normalized, mode: 'insensitive' } },
      select: { id: true },
    });
    return existing?.id ?? null;
  }
}

/**
 * Find the destination-collection category matching a source category name.
 * A move never creates categories in the destination implicitly: an item whose
 * category has no counterpart simply loses the relation while keeping its
 * category text.
 */
export async function matchCategoryId(
  client: CategoryClient,
  wishlistId: string,
  name: unknown
): Promise<string | null> {
  const normalized = normalizeCategoryName(name);
  if (!normalized) return null;

  const category = await client.wishlistCategory.findFirst({
    where: { wishlistId, name: { equals: normalized, mode: 'insensitive' } },
    select: { id: true },
  });
  return category?.id ?? null;
}
