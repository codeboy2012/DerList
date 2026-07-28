/**
 * POST /api/wishlists/items/[id]/promote-children
 *
 * Promotes all direct children of an item to root level (sets parentId to null).
 * Used before deleting a parent when user wants to keep the children.
 */

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const item = await prisma.wishlistItem.findFirst({
    where: { id },
    include: { wishlist: { select: { ownerId: true, id: true } } },
  });

  if (!item || item.wishlist.ownerId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Promote all direct children to root (parentId = null)
  await prisma.wishlistItem.updateMany({
    where: { parentId: id },
    data: { parentId: null },
  });

  revalidatePath(`/wishlists/${item.wishlist.id}`);

  return NextResponse.json({ success: true });
}
