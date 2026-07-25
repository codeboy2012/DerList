/**
 * POST /api/ai/parse-products
 *
 * Product Getter endpoint. Parses messy text input into structured
 * product information and matches against DerList's product database.
 *
 * Body: { input: string, model?: string }
 * Returns: { success, parsed, matched, unmatched, error? }
 */

import { getCurrentUser } from '@/lib/auth';
import { parseProducts } from '@/lib/ai/product-getter';
import { isPuterAvailable } from '@/lib/ai/puter';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  if (!isPuterAvailable()) {
    return Response.json(
      { success: false, error: 'Product Getter AI is not configured. Contact the administrator.' },
      { status: 503 },
    );
  }

  let body: { input?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { input, model } = body;

  if (!input || typeof input !== 'string' || input.trim().length < 2) {
    return Response.json({ success: false, error: 'Input is required (min 2 characters).' }, { status: 400 });
  }

  if (input.length > 5000) {
    return Response.json({ success: false, error: 'Input too long (max 5000 characters).' }, { status: 400 });
  }

  const result = await parseProducts(input.trim(), model);

  return Response.json(result);
}
