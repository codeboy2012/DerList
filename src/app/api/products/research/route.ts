/**
 * POST /api/products/research
 *
 * Full product research pipeline: Collect real data → Merge → AI normalize.
 * Returns source-attributed data with confidence scores.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProviderManager } from '@/lib/providers';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { ProductResearchService, type ResearchInput } from '@/lib/services/product-research';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rate = checkRateLimit(`ai:research:${user.id}`, 15, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many research requests. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

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

  if (
    (body.title?.length ?? 0) > 300 ||
    (body.url?.length ?? 0) > 2000 ||
    (body.urls?.length ?? 0) > 20 ||
    body.urls?.some((entry) => entry.length > 2000)
  ) {
    return NextResponse.json(
      { error: 'Research input is too large (title 300, URL 2000, max 20 URLs).' },
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
