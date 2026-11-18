'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Server Action: Update the star priority of a wishlist item.
 */
export async function updateStarPriorityAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const itemId = formData.get('itemId') as string;
  const wishlistId = formData.get('wishlistId') as string;
  const priority = parseInt(formData.get('starPriority') as string, 10);

  // Validate priority is 1-4
  if (isNaN(priority) || priority < 1 || priority > 4) return;

  // The item must belong to the submitted collection and that collection must
  // belong to the caller; a valid wishlistId alone must not authorise an item.
  const { count } = await prisma.wishlistItem.updateMany({
    where: { id: itemId, wishlistId, wishlist: { ownerId: user.id } },
    data: { starPriority: priority },
  });
  if (count === 0) return;

  revalidatePath(`/wishlists/${wishlistId}`);
}
