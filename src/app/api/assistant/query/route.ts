/**
 * POST /api/assistant/query
 *
 * Shopping assistant endpoint.
 * Handles conversational queries and returns AI responses + product suggestions.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServices } from '@/lib/services/create';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { message?: string; conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { message, conversationId } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  }

  try {
    const { assistant } = createServices();
    const response = await assistant.handleMessage(user.id, message.trim(), conversationId);

    return NextResponse.json({
      success: true,
      message: response.message,
      products: response.products,
      conversationId: response.conversationId,
    });
  } catch (error) {
    console.error('Assistant error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Assistant request failed.',
      },
      { status: 500 }
    );
  }
}
