import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Export everything DerList stores about the signed-in user as JSON.
 *
 * The export is lossless for stored collection/item data: archive state,
 * ordering, category relations and the extended metadata blob are all
 * preserved. Provider credentials are deliberately excluded — they are
 * encrypted secrets, not user data, and must never leave the server in
 * plaintext.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      emailVerified: true,
      lastLoginAt: true,
      // Scoped to the signed-in user by the relation itself.
      wishlists: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          categories: { orderBy: { sortOrder: 'asc' } },
          items: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
        },
      },
    },
  });

  if (!account) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    application: 'DerList',
    format: 'derlist-account-export@2',
    account: {
      id: account.id,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      email: account.email,
      username: account.username,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      role: account.role,
      emailVerified: account.emailVerified,
      lastLoginAt: account.lastLoginAt,
    },
    collections: account.wishlists.map((wishlist) => ({
      id: wishlist.id,
      title: wishlist.title,
      description: wishlist.description,
      slug: wishlist.slug,
      visibility: wishlist.visibility,
      icon: wishlist.icon,
      color: wishlist.color,
      notice: wishlist.notice,
      archived: wishlist.archived,
      sortOrder: wishlist.sortOrder,
      topPicks: wishlist.topPicks ?? null,
      createdAt: wishlist.createdAt,
      updatedAt: wishlist.updatedAt,
      categories: wishlist.categories.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        notes: category.notes,
        externalLink: category.externalLink,
        externalLinkLabel: category.externalLinkLabel,
        icon: category.icon,
        sortOrder: category.sortOrder,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      })),
      items: wishlist.items.map((item) => ({
        id: item.id,
        wishlistId: item.wishlistId,
        // Category relation plus the denormalized label.
        wishlistCategoryId: item.wishlistCategoryId,
        category: item.category,
        title: item.title,
        description: item.description,
        url: item.url,
        image: item.image,
        brand: item.brand,
        model: item.model,
        condition: item.condition,
        availability: item.availability,
        retailer: item.retailer,
        currentPrice: item.currentPrice?.toString() ?? null,
        targetPrice: item.targetPrice?.toString() ?? null,
        originalPrice: item.originalPrice?.toString() ?? null,
        currency: item.currency,
        dealInfo: item.dealInfo,
        quantity: item.quantity,
        priority: item.priority,
        starPriority: item.starPriority,
        notes: item.notes,
        purchased: item.purchased,
        purchasedAt: item.purchasedAt,
        archived: item.archived,
        archivedAt: item.archivedAt,
        position: item.position,
        productId: item.productId,
        metadata: parseStoredMetadata(item.metadata),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    })),
  };

  const filename = `derlist-export-${account.username}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * `metadata` is stored as a JSON string. Export it as structured data when it
 * parses, and keep the raw string otherwise so no stored value is lost.
 */
function parseStoredMetadata(raw: string | null): unknown {
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}
