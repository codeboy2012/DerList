/**
 * POST /api/wishlists/add-item
 *
 * Add a product to a wishlist from AI/Product Getter results.
 * Handles both existing products (by productId) and new manual entries.
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  // Parse body — supports both JSON and FormData
  let body: Record<string, unknown>;
  const contentType = request.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      // FormData (from ProductEditor and UniversalInput batch add)
      const formData = await request.formData();
      body = {};
      for (const [key, value] of formData.entries()) {
        body[key] = value;
      }
    }
  } catch {
    return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const wishlistId = body.wishlistId as string;
  if (!wishlistId) {
    return Response.json({ success: false, error: 'wishlistId is required.' }, { status: 400 });
  }

  // Verify ownership
  const wishlist = await prisma.wishlist.findUnique({
    where: { id: wishlistId },
    select: { ownerId: true },
  });

  if (!wishlist || wishlist.ownerId !== user.id) {
    return Response.json({ success: false, error: 'Wishlist not found.' }, { status: 404 });
  }

  const title = body.title as string;
  if (!title || title.trim().length === 0) {
    return Response.json({ success: false, error: 'Title is required.' }, { status: 400 });
  }

  const productId = body.productId as string | undefined;
  const parentId = body.parentId as string | undefined;
  const starPriority = Math.max(1, Math.min(4, Number(body.starPriority) || 1));

  // If productId is provided, check for duplicates
  if (productId) {
    const existing = await prisma.wishlistItem.findFirst({
      where: { wishlistId, productId },
      select: { id: true, title: true },
    });
    if (existing) {
      return Response.json(
        { success: false, error: `"${existing.title}" is already in this wishlist.` },
        { status: 409 }
      );
    }
  }

  // Get next position (within the same parent scope)
  const lastItem = await prisma.wishlistItem.findFirst({
    where: { wishlistId, parentId: parentId ?? null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (lastItem?.position ?? -1) + 1;

  // Create the wishlist item
  await prisma.wishlistItem.create({
    data: {
      wishlistId,
      productId: productId || null,
      parentId: parentId || null,
      title: title.trim(),
      description: (body.description as string) || null,
      url: (body.url as string) || null,
      image: (body.image as string) || null,
      brand: (body.brand as string) || null,
      retailer: (body.retailer as string) || null,
      currentPrice: body.currentPrice != null ? Number(body.currentPrice) : null,
      currency: (body.currency as string) || 'USD',
      category: (body.category as string) || null,
      starPriority,
      position,
    },
  });

  revalidatePath(`/wishlists/${wishlistId}`);
  revalidatePath('/dashboard');

  return Response.json({ success: true });
}
