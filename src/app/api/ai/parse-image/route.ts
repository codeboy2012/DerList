/**
 * POST /api/ai/parse-image
 *
 * Product Getter image analysis endpoint. Analyzes screenshots or product
 * images to identify products, then matches against DerList's database.
 *
 * Body: { imageUrl: string, model?: string }
 * Returns: { success, parsed, matched, unmatched, error? }
 */

import { getCurrentUser } from '@/lib/auth';
import { parseImage, isProductGetterAvailable } from '@/lib/ai';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  if (!(await isProductGetterAvailable(user.id))) {
    return Response.json(
      { success: false, error: 'Image analysis AI is not configured. Please configure an AI provider in Settings.' },
      { status: 503 },
    );
  }

  let body: { imageUrl?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { imageUrl, model } = body;

  if (!imageUrl || typeof imageUrl !== 'string') {
    return Response.json({ success: false, error: 'imageUrl is required.' }, { status: 400 });
  }

  // Basic URL validation
  try {
    new URL(imageUrl);
  } catch {
    return Response.json({ success: false, error: 'Invalid image URL.' }, { status: 400 });
  }

  const result = await parseImage(imageUrl, user.id, model);

  return Response.json(result);
}
