import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/products/search?q=<query>
 *
 * Search the existing product database by title, brand, retailer, SKU, GTIN,
 * MPN, domain, and description.
 * Returns up to 20 results ordered by relevance (exact title matches first).
 * Used by the Product Finder UI.
 * Searches globally (not scoped to user) since products are shared entities.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ results: [] }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim();
  if (!query || query.length < 2) {
    return Response.json({ results: [] });
  }

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { brand: { contains: query, mode: 'insensitive' } },
        { retailer: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
        { gtin: { contains: query, mode: 'insensitive' } },
        { mpn: { contains: query, mode: 'insensitive' } },
        { domain: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      title: true,
      brand: true,
      retailer: true,
      image: true,
      currentPrice: true,
      currency: true,
      inStock: true,
      canonicalUrl: true,
      domain: true,
      sku: true,
      gtin: true,
      source: true,
      lastFetchedAt: true,
    },
  });

  // Sort by relevance: exact title matches first, then contains matches
  const queryLower = query.toLowerCase();
  const sorted = products.sort((a, b) => {
    const aExact = a.title.toLowerCase() === queryLower;
    const bExact = b.title.toLowerCase() === queryLower;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aStartsWith = a.title.toLowerCase().startsWith(queryLower);
    const bStartsWith = b.title.toLowerCase().startsWith(queryLower);
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;

    return 0;
  });

  const results = sorted.map((p) => ({
    id: p.id,
    title: p.title,
    brand: p.brand,
    retailer: p.retailer,
    image: p.image,
    price: p.currentPrice ? Number(p.currentPrice) : null,
    currency: p.currency,
    inStock: p.inStock,
    url: p.canonicalUrl,
    domain: p.domain,
    sku: p.sku,
    gtin: p.gtin,
    source: p.source,
    lastFetchedAt: p.lastFetchedAt,
  }));

  return Response.json({ results });
}
