/**
 * Owner-scoped document metadata for collection pages.
 *
 * `generateMetadata` runs outside the page component, so it cannot rely on the
 * page's `notFound()` guard. Looking a collection up by id alone would put a
 * foreign collection's title in the document `<title>` even though the body
 * renders "Page not found". Every lookup therefore includes the signed-in
 * owner, and missing/foreign/archived-out cases fall back to generic copy.
 */

import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';

export function genericWishlistTitle(kind: 'detail' | 'edit'): string {
  return kind === 'edit' ? `Edit Wishlist — ${siteConfig.name}` : `Wishlist — ${siteConfig.name}`;
}

export async function wishlistMetadataTitle(
  wishlistId: string,
  userId: string | null,
  kind: 'detail' | 'edit'
): Promise<string> {
  if (!wishlistId || !userId) return genericWishlistTitle(kind);

  const wishlist = await prisma.wishlist.findFirst({
    where: { id: wishlistId, ownerId: userId },
    select: { title: true },
  });

  if (!wishlist) return genericWishlistTitle(kind);
  return kind === 'edit'
    ? `Edit ${wishlist.title} — ${siteConfig.name}`
    : `${wishlist.title} — ${siteConfig.name}`;
}
