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

  // Verify ownership
  const item = await prisma.wishlistItem.findUnique({
    where: { id: itemId },
    select: { wishlist: { select: { ownerId: true } } },
  });
  if (!item || item.wishlist.ownerId !== user.id) return;

  await prisma.wishlistItem.update({
    where: { id: itemId },
    data: { starPriority: priority },
  });

  revalidatePath(`/wishlists/${wishlistId}`);
}
