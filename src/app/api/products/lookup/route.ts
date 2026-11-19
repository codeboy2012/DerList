import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProviderManager } from '@/lib/providers';
import { checkRateLimit } from '@/lib/security/rate-limit';

/**
 * GET /api/products/lookup?q=<query>
 *
 * Search for products using the signed-in user's configured shopping search
 * provider. This intentionally searches the external catalogue only: DerList
 * never exposes products from other accounts or builds a cross-account index.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json(
      { success: false, error: 'Enter a product search between 2 and 120 characters.' },
      { status: 400 }
    );
  }

  const rate = checkRateLimit(`lookup:${user.id}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many lookups. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const providers = getProviderManager();
    const provider = await providers.getSearchProvider(user.id);

    if (!provider) {
      return NextResponse.json(
        {
          success: false,
          code: 'no_search_provider',
          error:
            'No shopping search provider is configured. Add one in Settings → Providers, or use Product URL or Manual Entry.',
        },
        { status: 503 }
      );
    }

    const results = await provider.search(query, { maxResults: 10 });

    // Only return fields the review UI needs. Provider responses can contain
    // tracking data or implementation details that should not reach the client.
    const safeResults = results
      .filter((result) => typeof result.url === 'string' && /^https?:\/\//i.test(result.url))
      .slice(0, 10)
      .map((result) => ({
        title: result.title,
        url: result.url,
        price: result.price,
        currency: result.currency,
        image: result.image,
        retailer: result.retailer,
        rating: result.rating,
        reviewCount: result.reviewCount,
        snippet: result.snippet,
        inStock: result.inStock,
      }));

    return NextResponse.json({
      success: true,
      provider: provider.name,
      results: safeResults,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Product lookup failed. Check the search provider configuration and try again.',
      },
      { status: 502 }
    );
  }
}
