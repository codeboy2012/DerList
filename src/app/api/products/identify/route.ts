/**
 * POST /api/products/identify
 *
 * Unified Product Getter API. Accepts any input type and returns
 * identified product candidates with confidence scores.
 *
 * Body: { type: 'url'|'text'|'image'|'search'|'manual', ...data }
 * Returns: { success, candidates, unmatched?, error? }
 */

import { getCurrentUser } from '@/lib/auth';
import { identifyProducts, type ProductGetterInput } from '@/lib/products/product-getter';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, candidates: [], error: 'Authentication required.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, candidates: [], error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { type } = body;

  if (!type || typeof type !== 'string') {
    return Response.json({ success: false, candidates: [], error: 'Missing "type" field.' }, { status: 400 });
  }

  let input: ProductGetterInput;

  switch (type) {
    case 'url': {
      const url = body.url;
      if (!url || typeof url !== 'string') {
        return Response.json({ success: false, candidates: [], error: 'Missing "url" field.' }, { status: 400 });
      }
      if (url.length > 2000) {
        return Response.json({ success: false, candidates: [], error: 'URL too long.' }, { status: 400 });
      }
      input = { type: 'url', url };
      break;
    }

    case 'text': {
      const text = body.text;
      if (!text || typeof text !== 'string' || text.trim().length < 2) {
        return Response.json({ success: false, candidates: [], error: 'Missing or too short "text" field.' }, { status: 400 });
      }
      if (text.length > 5000) {
        return Response.json({ success: false, candidates: [], error: 'Text too long (max 5000 chars).' }, { status: 400 });
      }
      input = { type: 'text', text: text.trim() };
      break;
    }

    case 'image': {
      const image = body.image;
      if (!image || typeof image !== 'string') {
        return Response.json({ success: false, candidates: [], error: 'Missing "image" field.' }, { status: 400 });
      }
      try {
        new URL(image);
      } catch {
        return Response.json({ success: false, candidates: [], error: 'Invalid image URL.' }, { status: 400 });
      }
      input = { type: 'image', image };
      break;
    }

    case 'search': {
      const query = body.query;
      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return Response.json({ success: false, candidates: [], error: 'Missing or too short "query" field.' }, { status: 400 });
      }
      if (query.length > 500) {
        return Response.json({ success: false, candidates: [], error: 'Query too long.' }, { status: 400 });
      }
      input = { type: 'search', query: query.trim() };
      break;
    }

    case 'manual': {
      const data = body.data;
      if (!data || typeof data !== 'object') {
        return Response.json({ success: false, candidates: [], error: 'Missing "data" object.' }, { status: 400 });
      }
      const d = data as Record<string, unknown>;
      if (!d.title || typeof d.title !== 'string' || d.title.trim().length === 0) {
        return Response.json({ success: false, candidates: [], error: 'Product title is required.' }, { status: 400 });
      }
      input = {
        type: 'manual',
        data: {
          title: (d.title as string).trim(),
          url: typeof d.url === 'string' ? d.url.trim() || undefined : undefined,
          image: typeof d.image === 'string' ? d.image.trim() || undefined : undefined,
          brand: typeof d.brand === 'string' ? d.brand.trim() || undefined : undefined,
          retailer: typeof d.retailer === 'string' ? d.retailer.trim() || undefined : undefined,
          sku: typeof d.sku === 'string' ? d.sku.trim() || undefined : undefined,
          category: typeof d.category === 'string' ? d.category.trim() || undefined : undefined,
          currentPrice: typeof d.currentPrice === 'number' ? d.currentPrice : undefined,
          originalPrice: typeof d.originalPrice === 'number' ? d.originalPrice : undefined,
          currency: typeof d.currency === 'string' ? d.currency.trim() || undefined : undefined,
          dealInfo: typeof d.dealInfo === 'string' ? d.dealInfo.trim() || undefined : undefined,
          description: typeof d.description === 'string' ? d.description.trim() || undefined : undefined,
        },
      };
      break;
    }

    default:
      return Response.json(
        { success: false, candidates: [], error: `Unknown type "${type}". Use: url, text, image, search, or manual.` },
        { status: 400 },
      );
  }

  const result = await identifyProducts(input, user.id);

  return Response.json(result);
}
