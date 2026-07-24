import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/search?q=<query>
 *
 * Global search across wishlists and products for the current user.
 * Returns up to 10 results instantly.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ results: [] });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim();
  if (!query || query.length < 2) {
    return Response.json({ results: [] });
  }

  const [wishlists, products] = await Promise.all([
    prisma.wishlist.findMany({
      where: {
        ownerId: user.id,
        title: { contains: query, mode: 'insensitive' },
      },
      take: 5,
      select: { id: true, title: true, icon: true },
    }),
    prisma.product.findMany({
      where: {
        wishlistItems: { some: { wishlist: { ownerId: user.id } } },
        title: { contains: query, mode: 'insensitive' },
      },
      take: 5,
      select: { id: true, title: true, retailer: true },
    }),
  ]);

  const results = [
    ...wishlists.map((w) => ({
      id: w.id,
      label: `${w.icon ?? '📋'} ${w.title}`,
      href: `/wishlists/${w.id}`,
      type: 'wishlist' as const,
    })),
    ...products.map((p) => ({
      id: p.id,
      label: p.title,
      description: p.retailer ?? undefined,
      href: `/products/${p.id}`,
      type: 'product' as const,
    })),
  ];

  return Response.json({ results });
}
