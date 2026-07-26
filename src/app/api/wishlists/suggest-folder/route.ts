/**
 * POST /api/wishlists/suggest-folder
 *
 * Analyzes a batch of imported items and suggests a folder grouping.
 * Called after import + enrichment is complete.
 *
 * Input: { wishlistId, itemIds }
 * Output: FolderSuggestion or null
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getProviderManager } from '@/lib/providers';
import { FolderSuggestionService, type ImportedItem } from '@/lib/services/folder-suggestion';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { wishlistId?: string; itemIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { wishlistId, itemIds } = body;

  if (!wishlistId || !itemIds || !Array.isArray(itemIds) || itemIds.length < 2) {
    return NextResponse.json(
      { error: 'wishlistId and at least 2 itemIds are required.' },
      { status: 400 }
    );
  }

  // Verify ownership
  const wishlist = await prisma.wishlist.findFirst({
    where: { id: wishlistId, ownerId: user.id },
  });
  if (!wishlist) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }

  // Load items
  const items = await prisma.wishlistItem.findMany({
    where: { id: { in: itemIds }, wishlistId },
    select: { id: true, title: true, brand: true, category: true, retailer: true },
  });

  if (items.length < 2) {
    return NextResponse.json({ success: true, suggestion: null });
  }

  const importedItems: ImportedItem[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    brand: i.brand || undefined,
    category: i.category || undefined,
    retailer: i.retailer || undefined,
  }));

  try {
    const providers = getProviderManager();
    const service = new FolderSuggestionService(providers);
    const suggestion = await service.analyzeBatch(importedItems, user.id, wishlistId);

    return NextResponse.json({ success: true, suggestion });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Analysis failed.' },
      { status: 500 }
    );
  }
}
