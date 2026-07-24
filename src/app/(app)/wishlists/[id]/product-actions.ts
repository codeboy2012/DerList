'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth';
import { importProductFromUrl } from '@/lib/products';
import { prisma } from '@/lib/prisma';
import { confirmImportSchema, createManualProductSchema, importUrlSchema } from '@/lib/validations/product';

import type { ActionState } from '../../../(auth)/actions';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: verify user owns the wishlist
// ─────────────────────────────────────────────────────────────────────────────

async function verifyOwnership(wishlistId: string, userId: string): Promise<boolean> {
  const wl = await prisma.wishlist.findUnique({
    where: { id: wishlistId },
    select: { ownerId: true },
  });
  return wl?.ownerId === userId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Import Product (Step 1: Fetch & Preview)
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportPreviewState {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  preview?: {
    canonicalUrl: string;
    normalizedUrl: string;
    domain: string | null;
    retailer: string | null;
    title: string;
    description: string | null;
    brand: string | null;
    sku: string | null;
    mpn: string | null;
    gtin: string | null;
    image: string | null;
    gallery: string[];
    currentPrice: number | null;
    currency: string;
    inStock: boolean | null;
    availability: string | null;
    confidence: number;
    priceSource: string;
    priceCandidates: Array<{ method: string; price: number; currency: string | null; confidence: number; reason: string }>;
    needsReview: boolean;
  };
}

/**
 * Server Action: Fetch product data from a URL and return a preview.
 * Does not save to DB yet — the user confirms first.
 */
export async function fetchImportPreviewAction(
  _prevState: ImportPreviewState,
  formData: FormData,
): Promise<ImportPreviewState> {
  await requireUser();

  const raw = { url: formData.get('url') };
  const parsed = importUrlSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const result = await importProductFromUrl(parsed.data.url);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, preview: result.data };
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm Import (Step 2: Save product + add to wishlist)
// ─────────────────────────────────────────────────────────────────────────────

export async function confirmImportAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const wishlistId = formData.get('wishlistId') as string;

  if (!(await verifyOwnership(wishlistId, user.id))) {
    return { success: false, error: 'Wishlist not found.' };
  }

  const raw = {
    canonicalUrl: formData.get('canonicalUrl'),
    normalizedUrl: formData.get('normalizedUrl'),
    domain: formData.get('domain') || null,
    retailer: formData.get('retailer') || null,
    title: formData.get('title'),
    description: formData.get('description') || null,
    brand: formData.get('brand') || null,
    sku: formData.get('sku') || null,
    mpn: formData.get('mpn') || null,
    gtin: formData.get('gtin') || null,
    image: formData.get('image') || null,
    gallery: formData.get('gallery') || '[]',
    currentPrice: formData.get('currentPrice') || null,
    currency: formData.get('currency') || 'USD',
    inStock: formData.get('inStock') === 'true' ? true : formData.get('inStock') === 'false' ? false : null,
    availability: formData.get('availability') || null,
  };

  const parsed = confirmImportSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'Invalid product data.' };
  }

  const data = parsed.data;

  // Duplicate detection: check if product with this canonical URL already exists
  let product = await prisma.product.findUnique({
    where: { canonicalUrl: data.canonicalUrl },
    select: { id: true, currentPrice: true },
  });

  // Enhanced duplicate detection: check SKU, GTIN, MPN
  if (!product && data.sku && data.retailer) {
    const bySku = await prisma.product.findFirst({
      where: { sku: data.sku, retailer: data.retailer },
      select: { id: true, currentPrice: true },
    });
    if (bySku) product = bySku;
  }

  if (!product && data.gtin) {
    const byGtin = await prisma.product.findFirst({
      where: { gtin: data.gtin },
      select: { id: true, currentPrice: true },
    });
    if (byGtin) product = byGtin;
  }

  if (!product && data.mpn && data.brand) {
    const byMpn = await prisma.product.findFirst({
      where: { mpn: data.mpn, brand: data.brand },
      select: { id: true, currentPrice: true },
    });
    if (byMpn) product = byMpn;
  }

  // Also try matching by normalized title + brand (fuzzy deduplication)
  if (!product && data.title && data.brand) {
    const byTitleBrand = await prisma.product.findFirst({
      where: {
        title: data.title,
        brand: data.brand,
        retailer: data.retailer,
      },
      select: { id: true, currentPrice: true },
    });
    if (byTitleBrand) product = byTitleBrand;
  }

  if (product) {
    // Reuse existing product — update pricing if newer
    const oldPrice = product.currentPrice;
    const newPrice = data.currentPrice;

    await prisma.product.update({
      where: { id: product.id },
      data: {
        currentPrice: newPrice,
        currency: data.currency,
        inStock: data.inStock,
        availability: data.availability,
        lastFetchedAt: new Date(),
      },
    });

    // Record price history and change if price differs
    if (newPrice != null && String(oldPrice) !== String(newPrice)) {
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          price: newPrice,
          currency: data.currency,
          availability: data.availability,
        },
      });
      await prisma.productChange.create({
        data: {
          productId: product.id,
          changeType: 'PRICE',
          oldValue: oldPrice != null ? String(oldPrice) : null,
          newValue: String(newPrice),
        },
      });
    }
  } else {
    // Create new product record
    let gallery: string[] = [];
    try {
      gallery = JSON.parse(data.gallery);
    } catch { /* ignore */ }

    product = await prisma.product.create({
      data: {
        canonicalUrl: data.canonicalUrl,
        normalizedUrl: data.normalizedUrl,
        domain: data.domain,
        retailer: data.retailer,
        title: data.title,
        description: data.description,
        brand: data.brand,
        sku: data.sku,
        mpn: data.mpn,
        gtin: data.gtin,
        image: data.image || null,
        gallery: gallery.length > 0 ? JSON.stringify(gallery) : null,
        currentPrice: data.currentPrice,
        currency: data.currency,
        inStock: data.inStock,
        availability: data.availability,
        source: 'IMPORTED',
        lastFetchedAt: new Date(),
      },
    });

    // Record initial price history
    if (data.currentPrice != null) {
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          price: data.currentPrice,
          currency: data.currency,
          availability: data.availability,
        },
      });
    }
  }

  // Get next position in wishlist
  const lastItem = await prisma.wishlistItem.findFirst({
    where: { wishlistId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (lastItem?.position ?? -1) + 1;

  // ── Duplicate prevention: check if this product is already in this wishlist ──
  const existingItem = await prisma.wishlistItem.findFirst({
    where: {
      wishlistId,
      OR: [
        // Same product record
        { productId: product.id },
        // Same URL (covers manual items linked to same URL)
        ...(data.canonicalUrl ? [{ url: data.canonicalUrl }] : []),
      ],
    },
    select: { id: true, title: true },
  });

  if (existingItem) {
    return {
      success: false,
      error: `This product is already in this wishlist: "${existingItem.title}". Use the existing item instead.`,
    };
  }

  // Add to wishlist
  await prisma.wishlistItem.create({
    data: {
      wishlistId,
      productId: product.id,
      title: data.title,
      description: data.description,
      url: data.canonicalUrl,
      image: data.image || null,
      brand: data.brand,
      retailer: data.retailer,
      currentPrice: data.currentPrice,
      currency: data.currency,
      position,
    },
  });

  // Auto-queue product for background refresh
  const { enqueueProductRefresh } = await import('@/lib/jobs/queue');
  if (product.id) {
    // Schedule first refresh in 12 hours
    const twelveHoursFromNow = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await enqueueProductRefresh(product.id, twelveHoursFromNow);
  }

  revalidatePath(`/wishlists/${wishlistId}`);
  revalidatePath('/dashboard');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Manual Product
// ─────────────────────────────────────────────────────────────────────────────

export async function createManualProductAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const wishlistId = formData.get('wishlistId') as string;

  if (!(await verifyOwnership(wishlistId, user.id))) {
    return { success: false, error: 'Wishlist not found.' };
  }

  const raw = {
    title: formData.get('title'),
    description: formData.get('description'),
    url: formData.get('url'),
    image: formData.get('image'),
    brand: formData.get('brand'),
    retailer: formData.get('retailer'),
    currentPrice: formData.get('currentPrice'),
    currency: formData.get('currency') || 'USD',
    sku: formData.get('sku'),
  };

  const parsed = createManualProductSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  // Create product record (MANUAL source)
  const product = await prisma.product.create({
    data: {
      title: data.title,
      description: data.description || null,
      canonicalUrl: data.url || null,
      normalizedUrl: data.url?.toLowerCase() || null,
      image: data.image || null,
      brand: data.brand || null,
      retailer: data.retailer || null,
      currentPrice: data.currentPrice,
      currency: data.currency,
      sku: data.sku || null,
      source: 'MANUAL',
    },
  });

  // Record initial price history if a price was provided
  if (data.currentPrice != null) {
    await prisma.priceHistory.create({
      data: {
        productId: product.id,
        price: data.currentPrice,
        currency: data.currency,
      },
    });
  }

  // Get next position
  const lastItem = await prisma.wishlistItem.findFirst({
    where: { wishlistId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (lastItem?.position ?? -1) + 1;

  // ── Duplicate prevention: check by URL or product ID ──
  if (data.url) {
    const existingByUrl = await prisma.wishlistItem.findFirst({
      where: { wishlistId, url: data.url },
      select: { id: true, title: true },
    });
    if (existingByUrl) {
      return {
        success: false,
        error: `This product is already in this wishlist: "${existingByUrl.title}".`,
      };
    }
  }

  // Add to wishlist
  await prisma.wishlistItem.create({
    data: {
      wishlistId,
      productId: product.id,
      title: data.title,
      description: data.description || null,
      url: data.url || null,
      image: data.image || null,
      brand: data.brand || null,
      retailer: data.retailer || null,
      currentPrice: data.currentPrice,
      currency: data.currency,
      position,
    },
  });

  revalidatePath(`/wishlists/${wishlistId}`);
  revalidatePath('/dashboard');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Existing Product (from search/database)
// ─────────────────────────────────────────────────────────────────────────────

export async function addExistingProductAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const wishlistId = formData.get('wishlistId') as string;
  const productId = formData.get('productId') as string;

  if (!(await verifyOwnership(wishlistId, user.id))) {
    return { success: false, error: 'Wishlist not found.' };
  }

  // Get the product
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      description: true,
      canonicalUrl: true,
      image: true,
      brand: true,
      retailer: true,
      currentPrice: true,
      currency: true,
    },
  });

  if (!product) {
    return { success: false, error: 'Product not found.' };
  }

  // Duplicate check
  const existing = await prisma.wishlistItem.findFirst({
    where: { wishlistId, productId: product.id },
    select: { id: true, title: true },
  });

  if (existing) {
    return { success: false, error: `Already in this wishlist: "${existing.title}"` };
  }

  // Get next position
  const lastItem = await prisma.wishlistItem.findFirst({
    where: { wishlistId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (lastItem?.position ?? -1) + 1;

  await prisma.wishlistItem.create({
    data: {
      wishlistId,
      productId: product.id,
      title: product.title,
      description: product.description,
      url: product.canonicalUrl,
      image: product.image,
      brand: product.brand,
      retailer: product.retailer,
      currentPrice: product.currentPrice,
      currency: product.currency,
      position,
    },
  });

  revalidatePath(`/wishlists/${wishlistId}`);
  revalidatePath('/dashboard');
  return { success: true };
}
