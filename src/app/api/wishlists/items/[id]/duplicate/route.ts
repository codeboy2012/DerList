/**
 * POST /api/wishlists/items/[id]/duplicate
 *
 * Duplicates an item and all its descendants (entire branch).
 * Creates new items with the same data but new IDs.
 */

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify ownership and load the item
  const item = await prisma.wishlistItem.findFirst({
    where: { id },
    include: { wishlist: { select: { ownerId: true, id: true } } },
  });

  if (!item || item.wishlist.ownerId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Load all descendants recursively
  const allItems = await prisma.wishlistItem.findMany({
    where: { wishlistId: item.wishlistId },
  });

  // Build a map of children per parent
  const childrenMap = new Map<string, typeof allItems>();
  for (const i of allItems) {
    if (i.parentId) {
      if (!childrenMap.has(i.parentId)) childrenMap.set(i.parentId, []);
      childrenMap.get(i.parentId)!.push(i);
    }
  }

  // Recursively duplicate
  async function duplicateItem(sourceId: string, newParentId: string | null): Promise<void> {
    const source = allItems.find((i) => i.id === sourceId);
    if (!source) return;

    const newItem = await prisma.wishlistItem.create({
      data: {
        wishlistId: source.wishlistId,
        title: `${source.title} (copy)`,
        description: source.description,
        url: source.url,
        image: source.image,
        brand: source.brand,
        retailer: source.retailer,
        currentPrice: source.currentPrice,
        originalPrice: source.originalPrice,
        currency: source.currency,
        dealInfo: source.dealInfo,
        priority: source.priority,
        starPriority: source.starPriority,
        quantity: source.quantity,
        notes: source.notes,
        category: source.category,
        parentId: newParentId,
        position: source.position + 1,
        metadata: source.metadata,
      },
    });

    // Duplicate children
    const children = childrenMap.get(sourceId) ?? [];
    for (const child of children) {
      await duplicateItem(child.id, newItem.id);
    }
  }

  await duplicateItem(id, item.parentId);

  revalidatePath(`/wishlists/${item.wishlistId}`);

  return NextResponse.json({ success: true });
}
