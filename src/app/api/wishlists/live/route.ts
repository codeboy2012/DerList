/**
 * GET /api/wishlists/live — Fetch current wishlist items for the live panel.
 *
 * Returns a flat list of unpurchased items from the user's primary wishlist.
 * Used by the LiveWishlistPanel for initial state hydration.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wishlist = await prisma.wishlist.findFirst({
    where: { ownerId: user.id, archived: false },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: { purchased: false },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          brand: true,
          retailer: true,
          currentPrice: true,
          currency: true,
          category: true,
          url: true,
          notes: true,
          starPriority: true,
          purchased: true,
        },
      },
    },
  });

  if (!wishlist) {
    return NextResponse.json({ items: [], wishlistId: null, title: null });
  }

  const items = wishlist.items.map((item) => ({
    id: item.id,
    title: item.title,
    brand: item.brand,
    retailer: item.retailer,
    price: item.currentPrice ? Number(item.currentPrice) : null,
    currency: item.currency,
    category: item.category,
    url: item.url,
    notes: item.notes,
    priority: item.starPriority,
    purchased: item.purchased,
  }));

  return NextResponse.json({
    items,
    wishlistId: wishlist.id,
    title: wishlist.title,
  });
}
