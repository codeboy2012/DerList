/**
 * Assistant Service
 *
 * Shopping assistant that handles natural language queries.
 * Delegates to ProductService for actual product operations.
 * Manages conversation history.
 */

import { prisma } from '@/lib/prisma';
import { ProviderManager } from '@/lib/providers';
import type { Message } from '@/lib/providers/types';
import { ProductService, type ProductDraft } from './product';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AssistantResponse {
  message: string;
  /** Products found/suggested (if any) */
  products?: ProductDraft[];
  /** Conversation ID for follow-ups */
  conversationId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are DerList's shopping assistant. You help users find products, compare options, and build wishlists.

When a user asks about products:
1. Identify what they're looking for
2. If they want specific products, extract search terms
3. Suggest relevant products with brief descriptions

Keep responses concise and helpful. Format product suggestions as a brief list.
If you're unsure what the user wants, ask a clarifying question.`;

export class AssistantService {
  constructor(
    private readonly providers: ProviderManager,
    private readonly products: ProductService
  ) {}

  /**
   * Handle a user message in a conversation.
   * Creates a new conversation if conversationId is not provided.
   */
  async handleMessage(
    userId: string,
    message: string,
    conversationId?: string
  ): Promise<AssistantResponse> {
    // Get or create conversation
    const conversation = conversationId
      ? await this.getConversation(conversationId, userId)
      : await this.createConversation(userId, message);

    if (!conversation) {
      throw new Error('Conversation not found.');
    }

    // Save user message
    await this.saveMessage(conversation.id, 'user', message);

    // Get conversation history for context
    const history = await this.getHistory(conversation.id);

    // Try to get AI response
    const aiProvider = await this.providers.getAIProvider(userId);

    if (!aiProvider) {
      // No AI available — fall back to search-only mode
      const searchResults = await this.products.search(message, userId);
      const products = searchResults.external.slice(0, 5).map((r): ProductDraft => ({
        title: r.title,
        url: r.url,
        currentPrice: r.price ?? undefined,
        currency: r.currency,
        image: r.image ?? undefined,
        retailer: r.retailer ?? undefined,
        source: 'search',
        confidence: 75,
      }));

      const reply =
        products.length > 0
          ? `I found ${products.length} products matching "${message}". Here are the top results:`
          : `I couldn't find products matching "${message}". Try being more specific or paste a URL.`;

      await this.saveMessage(conversation.id, 'assistant', reply);

      return {
        message: reply,
        products: products.length > 0 ? products : undefined,
        conversationId: conversation.id,
      };
    }

    // Build messages for AI
    const messages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Get AI response
    let aiReply: string;
    try {
      const response = await aiProvider.chat(messages, { maxTokens: 500, temperature: 0.7 });
      aiReply = response.content;
    } catch {
      aiReply = 'Sorry, I had trouble processing that. Could you try rephrasing?';
    }

    // Try to find products based on the query
    let products: ProductDraft[] | undefined;
    try {
      const searchResults = await this.products.search(message, userId);
      if (searchResults.external.length > 0) {
        products = searchResults.external.slice(0, 5).map((r): ProductDraft => ({
          title: r.title,
          url: r.url,
          currentPrice: r.price ?? undefined,
          currency: r.currency,
          image: r.image ?? undefined,
          retailer: r.retailer ?? undefined,
          source: 'search',
          confidence: 75,
        }));
      }
    } catch {
      // Search failed — still return the AI response
    }

    // Save assistant response
    await this.saveMessage(conversation.id, 'assistant', aiReply);

    return {
      message: aiReply,
      products,
      conversationId: conversation.id,
    };
  }

  /**
   * Get conversation history.
   */
  async getConversations(userId: string) {
    return prisma.shoppingConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // ─── Private ───

  private async createConversation(userId: string, firstMessage: string) {
    // Use first ~50 chars of the message as title
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');

    return prisma.shoppingConversation.create({
      data: { userId, title },
    });
  }

  private async getConversation(id: string, userId: string) {
    return prisma.shoppingConversation.findFirst({
      where: { id, userId },
    });
  }

  private async getHistory(conversationId: string) {
    return prisma.shoppingMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20, // Keep context window manageable
      select: { role: true, content: true },
    });
  }

  private async saveMessage(conversationId: string, role: string, content: string) {
    await prisma.shoppingMessage.create({
      data: { conversationId, role, content },
    });

    // Update conversation timestamp
    await prisma.shoppingConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }
}
