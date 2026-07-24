/**
 * Product Sync — fetches latest data for a product, compares,
 * records price history and changes, then updates the product record.
 */

import { fetchProductPage } from '@/lib/products/fetch';
import { runExtractionPipeline } from '@/lib/products/engine';
import { extractDomain } from '@/lib/products/normalize';
import { prisma } from '@/lib/prisma';

export interface SyncResult {
  success: boolean;
  error?: string;
  priceChanged?: boolean;
  stockChanged?: boolean;
}

/**
 * Sync a single product: re-fetch its page, compare values,
 * record history and changes, update the product record.
 *
 * Skips products without a canonical URL (manual entries can't be synced).
 */
export async function syncProduct(productId: string): Promise<SyncResult> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      canonicalUrl: true,
      currentPrice: true,
      currency: true,
      inStock: true,
      title: true,
      image: true,
      description: true,
    },
  });

  if (!product) {
    return { success: false, error: 'Product not found.' };
  }

  if (!product.canonicalUrl) {
    return { success: false, error: 'No URL to fetch (manual product).' };
  }

  // Fetch the page
  let html: string;
  try {
    const result = await fetchProductPage(product.canonicalUrl);
    html = result.html;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fetch failed.';
    return { success: false, error: message };
  }

  // Extract metadata via pipeline
  const domain = extractDomain(product.canonicalUrl);
  const metadata = await runExtractionPipeline({ html, url: product.canonicalUrl, domain });
  if (!metadata.title) {
    return { success: false, error: 'Could not extract product data.' };
  }

  let priceChanged = false;
  let stockChanged = false;

  // Record price history if price is available
  if (metadata.price != null) {
    await prisma.priceHistory.create({
      data: {
        productId: product.id,
        price: metadata.price,
        currency: metadata.currency ?? product.currency,
        availability: metadata.availability ?? null,
        extractionMethod: metadata.priceSource ?? null,
        extractionConfidence: metadata.confidence ?? null,
      },
    });

    // Detect price change
    const oldPrice = product.currentPrice ? Number(product.currentPrice) : null;
    if (oldPrice !== null && oldPrice !== metadata.price) {
      priceChanged = true;
      await prisma.productChange.create({
        data: {
          productId: product.id,
          changeType: 'PRICE',
          oldValue: oldPrice.toFixed(2),
          newValue: metadata.price.toFixed(2),
        },
      });
    }
  }

  // Detect stock change
  if (metadata.inStock !== null && product.inStock !== null && metadata.inStock !== product.inStock) {
    stockChanged = true;
    await prisma.productChange.create({
      data: {
        productId: product.id,
        changeType: 'STOCK',
        oldValue: product.inStock ? 'In Stock' : 'Out of Stock',
        newValue: metadata.inStock ? 'In Stock' : 'Out of Stock',
      },
    });
  }

  // Detect title change
  if (metadata.title && metadata.title !== product.title) {
    await prisma.productChange.create({
      data: {
        productId: product.id,
        changeType: 'TITLE',
        oldValue: product.title,
        newValue: metadata.title,
      },
    });
  }

  // Detect image change
  if (metadata.image && metadata.image !== product.image) {
    await prisma.productChange.create({
      data: {
        productId: product.id,
        changeType: 'IMAGE',
        oldValue: product.image,
        newValue: metadata.image,
      },
    });
  }

  // Update the product record (skip unnecessary writes)
  await prisma.product.update({
    where: { id: product.id },
    data: {
      // Continuous learning: merge in any newly discovered data
      title: metadata.title ?? product.title,
      description: metadata.description ?? product.description,
      image: metadata.image ?? product.image,
      currentPrice: metadata.price ?? product.currentPrice,
      currency: metadata.currency ?? product.currency,
      inStock: metadata.inStock ?? product.inStock,
      availability: metadata.availability,
      brand: metadata.brand ?? undefined,
      // Learn new identifiers if discovered
      sku: metadata.sku ?? undefined,
      mpn: metadata.mpn ?? undefined,
      gtin: metadata.gtin ?? undefined,
      lastFetchedAt: new Date(),
      // Import analytics
      refreshCount: { increment: 1 },
      lastExtractionMethod: metadata.priceSource ?? undefined,
      // Rolling average confidence: new_avg = (old_avg * (n-1) + new_conf) / n
      // Simplified: just update with latest confidence for now
      avgConfidence: metadata.confidence ?? undefined,
    },
  });

  return { success: true, priceChanged, stockChanged };
}
