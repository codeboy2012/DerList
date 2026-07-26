/**
 * POST /api/ai/parse-products
 *
 * Parse text input into structured product data using AI.
 * Handles shopping lists, receipts, and free-form text.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { universalImport } from '@/lib/importers';
import { createServices } from '@/lib/services/create';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { input?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON.' }, { status: 400 });
  }

  const { input } = body;
  if (!input || typeof input !== 'string' || input.trim().length < 2) {
    return NextResponse.json(
      { success: false, error: 'Input required (min 2 chars).' },
      { status: 400 }
    );
  }

  if (input.length > 5000) {
    return NextResponse.json(
      { success: false, error: 'Input too long (max 5000 chars).' },
      { status: 400 }
    );
  }

  try {
    // Use the universal import pipeline
    const result = await universalImport(input.trim());

    // Try to enrich with AI if confidence is low
    const { products } = createServices();
    const enrichedDrafts = await Promise.all(
      result.drafts.map(async (draft) => {
        if (draft.confidence < 70) {
          try {
            return await products.enrich(draft, user.id);
          } catch {
            return draft;
          }
        }
        return draft;
      })
    );

    return NextResponse.json({
      success: true,
      parsed: enrichedDrafts,
      isBatch: result.isBatch,
      batchName: result.batchName,
    });
  } catch (error) {
    console.error('Parse products error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to parse products.' },
      { status: 500 }
    );
  }
}
