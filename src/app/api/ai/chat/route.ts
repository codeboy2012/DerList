/**
 * POST /api/ai/chat
 *
 * Shopping AI chat endpoint. Authenticated users can send messages
 * and receive AI responses powered by configured AI providers.
 *
 * Body: { message: string, history?: ChatMessage[], model?: string }
 * Returns: { success, message, messages, error? }
 */

import { getCurrentUser } from '@/lib/auth';
import { chat, isShoppingAIAvailable, type ChatMessage } from '@/lib/ai';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  if (!(await isShoppingAIAvailable(user.id))) {
    return Response.json(
      { success: false, error: 'Shopping AI is not configured. Please configure an AI provider in Settings.' },
      { status: 503 },
    );
  }

  let body: { message?: string; history?: ChatMessage[]; model?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { message, history = [], model } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return Response.json({ success: false, error: 'Message is required.' }, { status: 400 });
  }

  if (message.length > 2000) {
    return Response.json({ success: false, error: 'Message too long (max 2000 characters).' }, { status: 400 });
  }

  // Sanitize history — only allow safe roles and limit size
  const sanitizedHistory: ChatMessage[] = Array.isArray(history)
    ? history
        .filter(
          (msg) =>
            msg &&
            typeof msg.role === 'string' &&
            ['user', 'assistant'].includes(msg.role) &&
            typeof msg.content === 'string',
        )
        .slice(-20) // Keep last 20 messages max
    : [];

  const result = await chat(message.trim(), sanitizedHistory, user.id, model);

  return Response.json(result);
}
