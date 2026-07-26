/**
 * POST /api/products/enrich — AI Product Enrichment endpoint.
 *
 * Supports:
 * - Single product enrichment (enriches and optionally saves to a wishlist item)
 * - Batch enrichment (enriches multiple products concurrently)
 *
 * The response includes provider failover metadata so the UI can show
 * notifications when models switch.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getProviderManager } from '@/lib/providers';
import { EnrichmentService, type EnrichmentInput } from '@/lib/services/enrichment';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    /** Single product to enrich */
    product?: EnrichmentInput;
    /** Batch of products to enrich */
    products?: EnrichmentInput[];
    /** If provided, save enrichment result to this wishlist item */
    itemId?: string;
    /** Whether to respect price lock on the item */
    priceLocked?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const providers = getProviderManager();
  const enrichmentService = new EnrichmentService(providers);

  // ─── Single Product Enrichment ───
  if (body.product) {
    if (!body.product.title || body.product.title.trim().length < 2) {
      return NextResponse.json(
        { error: 'Product title is required (min 2 chars).' },
        { status: 400 }
      );
    }

    try {
      const result = await enrichmentService.enrichProduct(body.product, user.id);

      // If itemId is provided, apply enrichment to the wishlist item
      if (body.itemId) {
        await applyEnrichmentToItem(
          body.itemId,
          user.id,
          result,
          enrichmentService,
          body.priceLocked
        );
      }

      return NextResponse.json({
        success: true,
        enrichment: result,
        providerSwitched: result.providerSwitched || false,
        switchReason: result.switchReason || null,
        modelUsed: result.modelUsed || null,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Enrichment failed.',
        },
        { status: 500 }
      );
    }
  }

  // ─── Batch Enrichment ───
  if (body.products && body.products.length > 0) {
    if (body.products.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 products per batch.' }, { status: 400 });
    }

    const validProducts = body.products.filter((p) => p.title && p.title.trim().length >= 2);
    if (validProducts.length === 0) {
      return NextResponse.json({ error: 'No valid products to enrich.' }, { status: 400 });
    }

    try {
      const results = await enrichmentService.enrichBatch(validProducts, user.id);

      // Check if any provider switched during batch
      const switched = results.find((r) => r.providerSwitched);

      return NextResponse.json({
        success: true,
        results,
        totalEnriched: results.filter((r) => r.confidence > 0).length,
        totalFailed: results.filter((r) => r.confidence === 0).length,
        providerSwitched: switched?.providerSwitched || false,
        switchReason: switched?.switchReason || null,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Batch enrichment failed.',
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Provide either "product" or "products" field.' },
    { status: 400 }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply enrichment to a wishlist item (smart merge into metadata)
// ─────────────────────────────────────────────────────────────────────────────

async function applyEnrichmentToItem(
  itemId: string,
  userId: string,
  result: Awaited<ReturnType<EnrichmentService['enrichProduct']>>,
  enrichmentService: EnrichmentService,
  priceLocked?: boolean
) {
  // Verify ownership
  const item = await prisma.wishlistItem.findFirst({
    where: { id: itemId },
    include: { wishlist: { select: { ownerId: true } } },
  });
  if (!item || item.wishlist.ownerId !== userId) return;

  // Parse existing metadata
  let metadata: Record<string, unknown> = {};
  try {
    if (item.metadata) metadata = JSON.parse(item.metadata);
  } catch {
    /* fresh metadata */
  }

  // Smart merge
  const merged = enrichmentService.smartMerge(metadata, result, { priceLocked });

  // Build column updates from enrichment (only fill empty native columns)
  const columnUpdates: Record<string, unknown> = {};
  if (!item.brand && result.brand) columnUpdates.brand = result.brand;
  if (!item.description && result.description) columnUpdates.description = result.description;
  if (!item.category && (result.category || result.suggestedCategory)) {
    columnUpdates.category = result.category || result.suggestedCategory;
  }
  if (!priceLocked) {
    if (!item.currentPrice && result.currentPrice) columnUpdates.currentPrice = result.currentPrice;
    if (!item.originalPrice && result.msrp) columnUpdates.originalPrice = result.msrp;
  }

  // Update the item
  await prisma.wishlistItem.update({
    where: { id: itemId },
    data: {
      ...columnUpdates,
      metadata: JSON.stringify(merged),
    },
  });
}
