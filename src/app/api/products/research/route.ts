/**
 * POST /api/products/research
 *
 * Full product research pipeline: Collect real data → Merge → AI normalize.
 * Returns source-attributed data with confidence scores.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProviderManager } from '@/lib/providers';
import { ProductResearchService, type ResearchInput } from '@/lib/services/product-research';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: ResearchInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.title && !body.url && !body.urls?.length) {
    return NextResponse.json(
      { error: 'Provide at least a title, url, or urls array.' },
      { status: 400 }
    );
  }

  try {
    const providers = getProviderManager();
    const service = new ProductResearchService(providers);
    const result = await service.research(body, user.id);

    return NextResponse.json({
      success: true,
      research: result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Research failed' },
      { status: 500 }
    );
  }
}
