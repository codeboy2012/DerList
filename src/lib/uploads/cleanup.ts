import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/uploads';

/**
 * Remove a user's uploaded files from storage before their account is deleted.
 *
 * Database rows cascade with the user, but the files themselves would otherwise
 * stay on disk forever. A file is only unlinked when no *other* record still
 * references its storage path — shared product images and anything another
 * account points at are kept.
 *
 * References are stored as URLs inside string columns (`avatarUrl`,
 * `Wishlist.icon`, `WishlistItem.image`, `Product.image/gallery`), so the check
 * is a substring match on the storage path, which is unique per upload.
 */
export async function deleteAccountUploads(userId: string): Promise<void> {
  const media = await prisma.media.findMany({
    where: { uploadedById: userId },
    select: { storagePath: true },
  });

  if (media.length === 0) return;

  const storage = getStorage();

  for (const { storagePath } of media) {
    if (!storagePath) continue;

    const [otherAvatars, otherWishlists, otherItems, products] = await Promise.all([
      prisma.user.count({
        where: { id: { not: userId }, avatarUrl: { contains: storagePath } },
      }),
      prisma.wishlist.count({
        where: { ownerId: { not: userId }, icon: { contains: storagePath } },
      }),
      prisma.wishlistItem.count({
        where: {
          wishlist: { ownerId: { not: userId } },
          image: { contains: storagePath },
        },
      }),
      prisma.product.count({
        where: {
          OR: [{ image: { contains: storagePath } }, { gallery: { contains: storagePath } }],
        },
      }),
    ]);

    if (otherAvatars + otherWishlists + otherItems + products === 0) {
      await storage.delete(storagePath);
    }
  }
}
