'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth';
import { syncProduct } from '@/lib/jobs';
import { prisma } from '@/lib/prisma';

/**
 * Refresh a product's data inline (user-initiated).
 * Only allows refreshing products that the user has on a wishlist.
 */
export async function refreshProductAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const productId = formData.get('productId') as string;

  // Verify the user has this product on one of their wishlists
  const item = await prisma.wishlistItem.findFirst({
    where: { productId, wishlist: { ownerId: user.id } },
    select: { id: true },
  });
  if (!item) return;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { canonicalUrl: true },
  });
  if (!product?.canonicalUrl) return;

  await syncProduct(productId);

  revalidatePath(`/products/${productId}`);
}
