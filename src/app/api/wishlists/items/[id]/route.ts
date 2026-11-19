/**
 * PATCH /api/wishlists/items/[id] — Full product editor save.
 * DELETE /api/wishlists/items/[id] — Delete a wishlist item.
 * GET /api/wishlists/items/[id] — Load full item data for the editor.
 *
 * Persists all editor fields: native columns where possible,
 * extended data in the `metadata` JSON column.
 */

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeCategoryName, resolveCategoryId } from '@/lib/services/wishlist-categories';

// ─────────────────────────────────────────────────────────────────────────────
// Types for the editor payload
// ─────────────────────────────────────────────────────────────────────────────

interface EditorPayload {
  // Native WishlistItem columns
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  brand?: string;
  retailer?: string;
  currentPrice?: string;
  originalPrice?: string;
  dealInfo?: string;
  currency?: string;
  priority?: string;
  starPriority?: number;
  quantity?: number;
  purchased?: boolean;
  notes?: string;
  category?: string;

  // Extended metadata (stored as JSON in `metadata` column)
  metadata?: ItemMetadata;
}

interface ItemMetadata {
  // Product identity extras
  model?: string;
  subCategory?: string;
  sku?: string;
  upc?: string;
  asin?: string;
  mpn?: string;
  storeUrl?: string;
  tags?: string;

  // Pricing extras
  salePrice?: string;
  dealAmount?: string;
  discountPercent?: string;
  shippingCost?: string;
  tax?: string;
  coupon?: string;
  promoCode?: string;
  finalTotal?: string;
  priceLocked?: boolean;

  // Sellers
  sellers?: SellerData[];

  // Images (beyond primary)
  images?: string[];
  primaryImageIndex?: number;

  // Wishlist extras
  desiredPrice?: string;
  purchaseStatus?: string;
  needByDate?: string;
  folder?: string;
  subFolder?: string;
  wishlistCategory?: string;
  wishlistNotes?: string;
  customLabels?: string;

  // AI Metadata
  aiConfidence?: string;
  aiTags?: string;
  aiSuggestedCategory?: string;
  aiSuggestedName?: string;

  // Specifications
  specs?: SpecData[];

  // History (read-only, set by system)
  importedFrom?: string;
  lastSynced?: string;
  provider?: string;
  extractionConfidence?: string;
}

interface SellerData {
  id: string;
  name: string;
  logo?: string;
  price: string;
  shipping: string;
  tax?: string;
  coupon?: string;
  promoCode?: string;
  url: string;
  availability: string;
  notes?: string;
  lastChecked?: string;
  isPreferred: boolean;
  isVerified?: boolean;
}

interface SpecData {
  id: string;
  key: string;
  value: string;
  unit?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function verifyItemOwnership(itemId: string, userId: string) {
  const item = await prisma.wishlistItem.findFirst({
    where: { id: itemId },
    include: { wishlist: { select: { ownerId: true } } },
  });
  if (!item || item.wishlist.ownerId !== userId) return null;
  return item;
}

function parseMetadataRecord(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseDecimal(value: string | undefined | null): number | null {
  if (!value || value.trim() === '') return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// GET — Load full item data for the editor
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const item = await verifyItemOwnership(id, user.id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Parse metadata JSON
  let metadata: ItemMetadata = {};
  try {
    if (item.metadata) {
      metadata = JSON.parse(item.metadata);
    }
  } catch {
    metadata = {};
  }

  return NextResponse.json({
    success: true,
    item: {
      id: item.id,
      wishlistId: item.wishlistId,
      title: item.title,
      description: item.description,
      url: item.url,
      image: item.image,
      brand: item.brand,
      retailer: item.retailer,
      currentPrice: item.currentPrice?.toString() ?? null,
      originalPrice: item.originalPrice?.toString() ?? null,
      dealInfo: item.dealInfo,
      currency: item.currency,
      priority: item.priority,
      starPriority: item.starPriority,
      quantity: item.quantity,
      purchased: item.purchased,
      purchasedAt: item.purchasedAt?.toISOString() ?? null,
      notes: item.notes,
      category: item.category,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      metadata,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — Save all editor fields
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const item = await verifyItemOwnership(id, user.id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (item.archived) {
    return NextResponse.json(
      { error: 'Restore this archived product before editing it.' },
      { status: 409 }
    );
  }

  let body: EditorPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate required fields
  if (body.title !== undefined && (!body.title || body.title.trim().length === 0)) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  // Build the native column update
  const data: Record<string, unknown> = {};

  if (body.title !== undefined) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description || null;
  if (body.url !== undefined) data.url = body.url || null;
  if (body.image !== undefined) data.image = body.image || null;
  if (body.brand !== undefined) data.brand = body.brand || null;
  if (body.retailer !== undefined) data.retailer = body.retailer || null;
  if (body.currentPrice !== undefined) data.currentPrice = parseDecimal(body.currentPrice);
  if (body.originalPrice !== undefined) data.originalPrice = parseDecimal(body.originalPrice);
  if (body.dealInfo !== undefined) data.dealInfo = body.dealInfo || null;
  if (body.currency !== undefined) data.currency = body.currency || 'USD';
  if (body.notes !== undefined) data.notes = body.notes || null;
  // `category` is handled inside the transaction below so the free-text field
  // and the `wishlistCategoryId` relation are written together.

  if (body.priority !== undefined) {
    const p = body.priority.toUpperCase();
    if (VALID_PRIORITIES.includes(p as (typeof VALID_PRIORITIES)[number])) {
      data.priority = p;
    }
  }

  if (body.starPriority !== undefined) {
    const sp = Number(body.starPriority);
    if (sp >= 1 && sp <= 4) data.starPriority = sp;
  }

  if (body.quantity !== undefined) {
    const q = Number(body.quantity);
    if (q >= 1 && q <= 999) data.quantity = q;
  }

  if (body.purchased !== undefined) {
    data.purchased = Boolean(body.purchased);
    data.purchasedAt = body.purchased ? new Date() : null;
  }

  // Merge metadata instead of replacing it. The editor submits the fields it
  // owns; enrichment-owned keys such as `pros`, `cons`, `buyingAdvice` and
  // `fieldConfidence` are not represented in that form and must survive an
  // edit. Fields the editor does submit (including empty values and empty
  // arrays) still overwrite their stored value.
  if (
    body.metadata !== undefined &&
    body.metadata !== null &&
    typeof body.metadata === 'object' &&
    !Array.isArray(body.metadata)
  ) {
    data.metadata = JSON.stringify({
      ...parseMetadataRecord(item.metadata),
      ...body.metadata,
    });
  }

  const categoryName = body.category !== undefined ? normalizeCategoryName(body.category) : null;

  const updated = await prisma.$transaction(async (tx) => {
    if (body.category !== undefined) {
      data.category = categoryName;
      // Keep the relation inside this item's collection. An unknown or emptied
      // category clears the relation instead of leaving a stale one.
      data.wishlistCategoryId = await resolveCategoryId(tx, item.wishlistId, categoryName);
    }

    return tx.wishlistItem.update({
      where: { id },
      data,
    });
  });

  revalidatePath(`/wishlists/${item.wishlistId}`);
  revalidatePath('/dashboard');

  return NextResponse.json({
    success: true,
    item: {
      id: updated.id,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — Remove a wishlist item
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const item = await verifyItemOwnership(id, user.id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Archived products are permanently deleted only through the archive flow,
  // which requires an explicit confirmation.
  if (item.archived) {
    return NextResponse.json(
      { error: 'Delete archived products from the archive view.' },
      { status: 409 }
    );
  }

  await prisma.wishlistItem.delete({ where: { id } });

  revalidatePath(`/wishlists/${item.wishlistId}`);
  revalidatePath('/dashboard');

  return NextResponse.json({ success: true });
}
