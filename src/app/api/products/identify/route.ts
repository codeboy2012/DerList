/**
 * POST /api/products/identify
 *
 * Universal product identification endpoint.
 * Accepts any input (URL, text, shopping list) and returns ProductDraft(s).
 * Uses the import pipeline + ProductService for identification.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { universalImport } from '@/lib/importers';
import { createServices } from '@/lib/services/create';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { input?: string; type?: string; data?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Support both new format (input) and legacy format (type + data)
  const input = body.input ?? (body.data as Record<string, string>)?.title ?? '';

  if (!input || typeof input !== 'string' || input.trim().length < 2) {
    return NextResponse.json({ error: 'Input is required (min 2 characters).' }, { status: 400 });
  }

  try {
    // 1. Run the universal import pipeline
    const importResult = await universalImport(input.trim());

    // 2. Try to enrich drafts with external data
    const { products } = createServices();
    const enrichedDrafts = await Promise.all(
      importResult.drafts.map(async (draft) => {
        try {
          return await products.enrich(draft, user.id);
        } catch {
          return draft; // Enrichment is best-effort
        }
      })
    );

    // 3. Return results in a format the ProductEditor can consume
    return NextResponse.json({
      success: true,
      drafts: enrichedDrafts,
      isBatch: importResult.isBatch,
      batchName: importResult.batchName,
      batchMeta: importResult.batchMeta,
      // Legacy compatibility: also return as "candidates" for the ManualTab AI identify button
      candidates: enrichedDrafts.map((d) => ({
        title: d.title,
        brand: d.brand,
        retailer: d.retailer,
        category: d.category,
        url: d.url,
        image: d.image,
        sku: d.sku,
        description: d.description,
        currentPrice: d.currentPrice,
        originalPrice: d.originalPrice,
        currency: d.currency ?? 'USD',
        dealInfo: d.dealInfo,
        confidence: d.confidence,
        verified: d.confidence >= 80,
      })),
    });
  } catch (error) {
    console.error('Product identify error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to identify product.', candidates: [] },
      { status: 500 }
    );
  }
}
