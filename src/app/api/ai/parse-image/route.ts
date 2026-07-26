/**
 * POST /api/ai/parse-image
 *
 * Analyze a product image using AI.
 * Extracts product information from the image URL.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProviderManager } from '@/lib/providers';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { imageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON.' }, { status: 400 });
  }

  const { imageUrl } = body;
  if (!imageUrl || typeof imageUrl !== 'string') {
    return NextResponse.json({ success: false, error: 'imageUrl is required.' }, { status: 400 });
  }

  try {
    new URL(imageUrl);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid URL.' }, { status: 400 });
  }

  try {
    const providers = getProviderManager();
    const aiProvider = await providers.getAIProvider(user.id);

    if (!aiProvider) {
      return NextResponse.json(
        { success: false, error: 'No AI provider configured.' },
        { status: 503 }
      );
    }

    const response = await aiProvider.chat(
      [
        {
          role: 'system',
          content:
            'You are a product identification assistant. Analyze the image at the URL and identify any products. Return a JSON array of products with: title, brand, price (number or null), category.',
        },
        {
          role: 'user',
          content: `Identify products in this image: ${imageUrl}`,
        },
      ],
      { maxTokens: 500, temperature: 0.1, json: true }
    );

    return NextResponse.json({
      success: true,
      analysis: response.content,
    });
  } catch (error) {
    console.error('Parse image error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze image.',
      },
      { status: 500 }
    );
  }
}
