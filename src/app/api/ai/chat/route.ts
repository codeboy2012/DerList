/**
 * POST /api/ai/chat
 *
 * AI chat endpoint. Sends a message to the user's configured AI provider.
 * Used by the shopping assistant and product identification.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProviderManager } from '@/lib/providers';
import type { Message } from '@/lib/providers/types';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { message?: string; history?: Message[]; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON.' }, { status: 400 });
  }

  const { message, history = [] } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Message is required.' }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json(
      { success: false, error: 'Message too long (max 2000 chars).' },
      { status: 400 }
    );
  }

  try {
    const providers = getProviderManager();
    const aiProvider = await providers.getAIProvider(user.id);

    if (!aiProvider) {
      return NextResponse.json(
        { success: false, error: 'No AI provider configured. Add one in Settings → Providers.' },
        { status: 503 }
      );
    }

    // Build message list
    const sanitizedHistory: Message[] = history
      .filter(
        (m) =>
          m && ['user', 'assistant', 'system'].includes(m.role) && typeof m.content === 'string'
      )
      .slice(-20);

    const messages: Message[] = [...sanitizedHistory, { role: 'user', content: message.trim() }];

    const response = await aiProvider.chat(messages, {
      maxTokens: 1000,
      temperature: 0.7,
    });

    return NextResponse.json({
      success: true,
      message: response.content,
      model: response.model,
      tokensUsed: response.tokensUsed,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'AI request failed.' },
      { status: 500 }
    );
  }
}
