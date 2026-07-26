/**
 * GET /api/wishlists/[id]/top-picks — Get the curated Top Picks.
 * PUT /api/wishlists/[id]/top-picks — Set/update the curated Top Picks.
 *
 * Top Picks are stored as native JSONB in the wishlist.topPicks column.
 * Prisma handles serialization automatically — no JSON.stringify needed.
 *
 * Max 3 picks. Positions are 1-indexed (1, 2, 3).
 */

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WishlistTopPick {
  position: 1 | 2 | 3;
  itemId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — Read Top Picks
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const wishlist = await prisma.wishlist.findUnique({
    where: { id },
    select: { topPicks: true, ownerId: true, visibility: true },
  });

  if (!wishlist) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }

  // Public/unlisted wishlists are readable by anyone; private requires auth
  if (wishlist.visibility === 'PRIVATE') {
    const user = await getCurrentUser();
    if (!user || user.id !== wishlist.ownerId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  // topPicks is already a parsed object from Prisma (Json type)
  const picks = Array.isArray(wishlist.topPicks) ? wishlist.topPicks : [];

  return NextResponse.json({ success: true, topPicks: picks });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT — Save Top Picks
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const wishlist = await prisma.wishlist.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true },
  });
  if (!wishlist) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }

  // Parse request body
  let body: { topPicks?: WishlistTopPick[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const picks = body.topPicks;
  if (!Array.isArray(picks)) {
    return NextResponse.json({ error: 'topPicks must be an array' }, { status: 400 });
  }

  // ─── Validation ───

  if (picks.length > 3) {
    return NextResponse.json({ error: 'Maximum 3 Top Picks allowed' }, { status: 400 });
  }

  const seenPositions = new Set<number>();
  const seenItems = new Set<string>();

  for (const pick of picks) {
    if (!pick.itemId || typeof pick.itemId !== 'string') {
      return NextResponse.json({ error: 'Each pick must have a valid itemId' }, { status: 400 });
    }
    if (typeof pick.position !== 'number' || pick.position < 1 || pick.position > 3) {
      return NextResponse.json({ error: 'Position must be 1, 2, or 3' }, { status: 400 });
    }
    if (seenPositions.has(pick.position)) {
      return NextResponse.json({ error: 'Duplicate position detected' }, { status: 400 });
    }
    if (seenItems.has(pick.itemId)) {
      return NextResponse.json(
        { error: 'An item cannot occupy multiple positions' },
        { status: 400 }
      );
    }
    seenPositions.add(pick.position);
    seenItems.add(pick.itemId);
  }

  // Verify all items belong to this wishlist
  if (picks.length > 0) {
    const itemIds = picks.map((p) => p.itemId);
    const validCount = await prisma.wishlistItem.count({
      where: { id: { in: itemIds }, wishlistId: id },
    });
    if (validCount !== itemIds.length) {
      return NextResponse.json(
        { error: 'One or more items do not belong to this wishlist' },
        { status: 400 }
      );
    }
  }

  // ─── Save (native JSON — no stringify needed) ───

  const updated = await prisma.wishlist.update({
    where: { id },
    data: { topPicks: picks as unknown as Prisma.InputJsonValue },
    select: { id: true, topPicks: true },
  });

  revalidatePath(`/wishlists/${id}`);

  return NextResponse.json({ success: true, topPicks: updated.topPicks });
}
