/**
 * POST /api/wishlists/import
 *
 * Fast product import with background AI enrichment.
 *
 * Stage 1 (instant): Create the wishlist item with basic data from URL/metadata.
 * Stage 2 (background): Run AI enrichment after response is sent via next/after.
 *
 * Returns immediately with the created item so the UI feels fast.
 * The item updates progressively as AI enrichment completes.
 */

import { revalidatePath } from 'next/cache';
import { after, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchProductPage } from '@/lib/products/fetch';
import { extractMetadata } from '@/lib/products/metadata';
import { getProviderManager } from '@/lib/providers';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { EnrichmentService } from '@/lib/services/enrichment';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rate = checkRateLimit(`import:${user.id}`, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many imports. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  let body: {
    wishlistId?: string;
    title?: string;
    description?: string;
    url?: string;
    brand?: string;
    image?: string;
    price?: number;
    originalPrice?: number;
    currency?: string;
    retailer?: string;
    category?: string;
    skipEnrichment?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { wishlistId } = body;
  if (!wishlistId) {
    return NextResponse.json({ error: 'wishlistId is required' }, { status: 400 });
  }

  // Verify ownership
  const wishlist = await prisma.wishlist.findFirst({
    where: { id: wishlistId, ownerId: user.id },
    select: { id: true },
  });
  if (!wishlist) {
    return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 });
  }

  // ─── Stage 1: Fast create with basic data ───

  let title = body.title?.trim() || '';
  let image = body.image || null;
  let price: number | null = body.price ?? null;
  let brand = body.brand || null;
  let retailer = body.retailer || null;
  let description: string | null = body.description?.trim() || null;
  let url = body.url || null;
  const currency = /^[A-Za-z]{3}$/.test(body.currency?.trim() ?? '')
    ? body.currency!.trim().toUpperCase()
    : 'USD';

  // If URL provided, try quick metadata extraction (fast — no AI)
  if (url && !title) {
    try {
      const { html, finalUrl } = await fetchProductPage(url);
      const domain = new URL(finalUrl).hostname.replace('www.', '');
      const meta = extractMetadata(html, domain);
      url = finalUrl;
      title = meta.title || url;
      image = image || meta.image;
      price = price ?? meta.price;
      brand = brand || meta.brand;
      description = description || meta.description;
      if (!retailer) {
        // Detect retailer from domain
        const retailerMap: Record<string, string> = {
          amazon: 'Amazon',
          bestbuy: 'Best Buy',
          walmart: 'Walmart',
          newegg: 'Newegg',
          target: 'Target',
          ebay: 'eBay',
          costco: 'Costco',
          apple: 'Apple',
          microcenter: 'Micro Center',
        };
        for (const [key, name] of Object.entries(retailerMap)) {
          if (domain.includes(key)) {
            retailer = name;
            break;
          }
        }
      }
    } catch {
      // Metadata extraction failed. Never use the URL as a product title;
      // the caller is asked for a real title below instead.
    }
  }

  title = title.trim();

  if (!title) {
    return NextResponse.json(
      {
        error: 'Could not read a product title from this URL. Enter a title and try again.',
      },
      { status: 422 }
    );
  }

  // Reuse an existing item for the same URL instead of duplicating it.
  if (url) {
    const existing = await prisma.wishlistItem.findFirst({
      where: { wishlistId, url },
      select: { id: true, title: true, image: true, currentPrice: true },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        deduplicated: true,
        item: {
          id: existing.id,
          title: existing.title,
          image: existing.image,
          currentPrice: existing.currentPrice?.toString() ?? null,
          brand,
          retailer,
          enriching: false,
        },
      });
    }
  }

  // Create the item and its position in one transaction so concurrent
  // imports cannot assign the same position.
  const item = await prisma.$transaction(async (tx) => {
    const lastItem = await tx.wishlistItem.findFirst({
      where: { wishlistId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (lastItem?.position ?? -1) + 1;

    return tx.wishlistItem.create({
      data: {
        wishlistId,
        title,
        description,
        url,
        image,
        brand,
        retailer,
        currentPrice: price,
        originalPrice: body.originalPrice ?? null,
        currency,
        category: body.category || null,
        position,
        // Mark as enrichment pending in metadata
        metadata: JSON.stringify({ enrichmentStatus: 'pending' }),
      },
    });
  });

  revalidatePath(`/wishlists/${wishlistId}`);
  revalidatePath('/dashboard');

  // ─── Stage 2: Background AI enrichment (runs after response is sent) ───

  if (!body.skipEnrichment) {
    after(async () => {
      try {
        const providers = getProviderManager();
        const enrichmentService = new EnrichmentService(providers);

        const result = await enrichmentService.enrichProduct(
          {
            title,
            brand: brand || undefined,
            category: body.category || undefined,
            description: description || undefined,
            url: url || undefined,
            retailer: retailer || undefined,
            currentPrice: price || undefined,
            image: image || undefined,
          },
          user.id
        );

        if (result.confidence > 0) {
          // Build updates from enrichment (only fill empty fields)
          const updates: Record<string, unknown> = {};
          if (!brand && result.brand) updates.brand = result.brand;
          if (!description && result.description) updates.description = result.description;
          if (!image && result.images?.[0]) updates.image = result.images[0];
          if (!price && result.currentPrice) updates.currentPrice = result.currentPrice;
          if (!body.category && (result.category || result.suggestedCategory)) {
            updates.category = result.category || result.suggestedCategory;
          }

          // Store full enrichment in metadata
          const metadata = {
            enrichmentStatus: 'complete',
            enrichedAt: new Date().toISOString(),
            model: result.model,
            sku: result.sku,
            upc: result.upc,
            asin: result.asin,
            mpn: result.mpn,
            tags: result.tags?.join(', '),
            searchKeywords: result.searchKeywords?.join(', '),
            // `specs` is the canonical metadata key. Readers still accept the
            // legacy `specifications` key for rows written before this change.
            specs: result.specifications?.map((s) => ({
              id: String(Date.now() + Math.random()),
              key: s.key,
              value: s.value,
              unit: s.unit || '',
            })),
            sellers: result.sellers?.map((s) => ({
              id: String(Date.now() + Math.random()),
              name: s.name,
              url: s.url || '',
              price: s.price ? String(s.price) : '',
              shipping: s.shipping || '',
              availability: s.availability || 'Unknown',
              isPreferred: false,
              isVerified: false,
            })),
            images: result.images || [],
            pros: result.pros,
            cons: result.cons,
            buyingAdvice: result.buyingAdvice,
            similarProducts: result.similarProducts,
            aiConfidence: String(result.confidence),
            fieldConfidence: result.fieldConfidence,
            seoTitle: result.seoTitle,
            seoDescription: result.seoDescription,
            shortDescription: result.shortDescription,
          };

          await prisma.wishlistItem.update({
            where: { id: item.id },
            data: {
              ...updates,
              metadata: JSON.stringify(metadata),
            },
          });

          revalidatePath(`/wishlists/${wishlistId}`);
        }
      } catch {
        // Background enrichment failed — mark as failed but don't crash
        await prisma.wishlistItem
          .update({
            where: { id: item.id },
            data: {
              metadata: JSON.stringify({ enrichmentStatus: 'failed' }),
            },
          })
          .catch(() => {});
      }
    });
  }

  // Return immediately — don't wait for enrichment
  return NextResponse.json({
    success: true,
    item: {
      id: item.id,
      title: item.title,
      image: item.image,
      currentPrice: item.currentPrice?.toString() ?? null,
      brand: item.brand,
      retailer: item.retailer,
      enriching: !body.skipEnrichment,
    },
  });
}
