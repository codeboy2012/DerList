/**
 * Assistant Service
 *
 * Conversational shopping assistant with:
 * - Natural language AI responses
 * - Product search integration
 * - Wishlist tools with permission checking
 * - Tool execution loop (AI requests actions → server executes → results fed back)
 * - Conversation persistence
 */

import { prisma } from '@/lib/prisma';
import { ProviderManager } from '@/lib/providers';
import type { Message } from '@/lib/providers/types';
import {
  type AIPermissions,
  type ToolResult,
  TOOL_DEFINITIONS,
  executeTool,
  parseToolCalls,
  stripToolCalls,
} from './assistant-tools';
import { ProductService, type ProductDraft } from './product';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AssistantResponse {
  message: string;
  products?: ProductDraft[];
  conversationId: string;
  toolResults?: ToolResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are DerList Shopping AI, a shopping research and deal-finding assistant.

GOAL:
Help users find products, compare options, build PCs, manage wishlists, and make smart purchasing decisions.

CAPABILITIES:
- Product research and recommendations
- Price comparison and deal evaluation
- PC building and component compatibility
- Wishlist management (when permitted)
- Shopping strategy and advice

RULES:
- Be concise and useful
- Never invent prices, availability, specifications, sellers, reviews, URLs, or discounts
- Default to NEW products only unless the user explicitly allows used/refurbished
- Prefer manufacturers, major retailers, authorized sellers, and reputable marketplaces
- Distinguish verified facts from uncertainty
- If no trustworthy option qualifies, say so
- Follow explicit user requirements and budgets
- Never claim a tool action succeeded unless it actually returned success
- If multiple wishlist items could match a request, ask which one

RESPONSE FORMAT:
- Keep responses focused and practical
- When recommending products, include key specs, price, and where to buy
- For comparisons, highlight meaningful differences
- For PC builds, check compatibility and stay within budget
`;

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class AssistantService {
  constructor(
    private readonly providers: ProviderManager,
    private readonly products: ProductService
  ) {}

  /**
   * Handle a user message in a conversation.
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

    // Get conversation history
    const history = await this.getHistory(conversation.id);

    // Get user permissions
    const permissions = await this.getUserPermissions(userId);

    // Get AI provider
    const aiProvider = await this.providers.getAIProvider(userId);

    if (!aiProvider) {
      const reply = 'No AI provider configured. Add one in Settings → Providers.';
      await this.saveMessage(conversation.id, 'assistant', reply);
      return { message: reply, conversationId: conversation.id };
    }

    // Build the system prompt with available tools based on permissions
    const toolPrompt = this.buildToolPrompt(permissions);
    const systemMessage = SYSTEM_PROMPT + toolPrompt;

    // Build messages for AI
    const messages: Message[] = [
      { role: 'system', content: systemMessage },
      ...history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: message },
    ];

    // AI response + tool execution loop
    let aiReply: string;
    const allToolResults: ToolResult[] = [];
    let attempts = 0;
    const MAX_TOOL_ROUNDS = 3; // Prevent infinite loops

    try {
      let response = await aiProvider.chat(messages, { maxTokens: 8000, temperature: 0.7 });
      aiReply = response.content;

      // Tool execution loop
      while (attempts < MAX_TOOL_ROUNDS) {
        const toolCalls = parseToolCalls(aiReply);
        if (toolCalls.length === 0) break;

        attempts++;

        // Execute all tool calls
        const results: ToolResult[] = [];
        for (const call of toolCalls) {
          const result = await executeTool(userId, call, permissions);
          results.push(result);
          allToolResults.push(result);
        }

        // Feed results back to AI — summarize to avoid token overflow
        const toolResultMessage = results
          .map((r) => {
            if (r.success) {
              // Summarize bulk results to avoid huge context
              const data = r.data as Record<string, unknown> | undefined;
              if (data && (data.added !== undefined || data.removed !== undefined)) {
                const summary: Record<string, unknown> = { ...data };
                delete summary.results; // Remove per-item details to save tokens
                return `Tool ${r.tool} succeeded: ${JSON.stringify(summary)}`;
              }
              return `Tool ${r.tool} succeeded: ${JSON.stringify(r.data)}`;
            }
            return `Tool ${r.tool} failed: ${r.error}`;
          })
          .join('\n');

        messages.push({ role: 'assistant', content: aiReply });
        messages.push({ role: 'user', content: `[TOOL RESULTS]\n${toolResultMessage}\n[/TOOL RESULTS]\n\nBriefly summarize what happened to the user. Do not use action blocks.` });

        // Get follow-up response with enough tokens for thinking + output
        response = await aiProvider.chat(messages, { maxTokens: 4000, temperature: 0.7 });
        aiReply = response.content;
      }

      // Strip any remaining action blocks from final response
      aiReply = stripToolCalls(aiReply);
    } catch (err) {
      aiReply = `Sorry, I had trouble processing that. ${err instanceof Error ? err.message : 'Please try again.'}`;
    }

    // Try product search for product-related queries (only if no tool calls handled it)
    let products: ProductDraft[] | undefined;
    if (allToolResults.length === 0 && this.isProductQuery(message)) {
      try {
        const searchResults = await this.products.search(message, userId);
        if (searchResults.external.length > 0) {
          products = searchResults.external.slice(0, 5).map(
            (r): ProductDraft => ({
              title: r.title,
              url: r.url,
              currentPrice: r.price ?? undefined,
              currency: r.currency,
              image: r.image ?? undefined,
              retailer: r.retailer ?? undefined,
              source: 'search',
              confidence: 75,
            })
          );
        }
      } catch {
        // Search failed — still return the AI response
      }
    }

    // Save assistant response
    const responseData: Record<string, unknown> = {};
    if (products) responseData.products = products;
    if (allToolResults.length > 0) responseData.toolResults = allToolResults;

    await this.saveMessage(
      conversation.id,
      'assistant',
      aiReply,
      Object.keys(responseData).length > 0 ? responseData : undefined
    );

    return {
      message: aiReply,
      products,
      conversationId: conversation.id,
      toolResults: allToolResults.length > 0 ? allToolResults : undefined,
    };
  }

  /**
   * Get conversation list.
   */
  async getConversations(userId: string) {
    return prisma.shoppingConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  // ─── Private ───

  /**
   * Build the tool section of the system prompt based on user permissions.
   */
  private buildToolPrompt(permissions: AIPermissions): string {
    const hasAnyPermission = Object.values(permissions).some(Boolean);
    if (!hasAnyPermission) {
      return '\n\nNote: The user has not granted you wishlist access. If they ask about their wishlist, suggest they enable it in Settings → AI Settings.';
    }
    return '\n\n' + TOOL_DEFINITIONS;
  }

  private isProductQuery(message: string): boolean {
    const lower = message.toLowerCase();
    const patterns = [
      'find', 'search', 'look for', 'recommend', 'suggest',
      'best', 'cheapest', 'buy', 'price', 'compare',
      'monitor', 'gpu', 'cpu', 'laptop', 'keyboard', 'headphone',
    ];
    return patterns.some((p) => lower.includes(p));
  }

  private async getUserPermissions(userId: string): Promise<AIPermissions> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiProviderConfig: true },
    });
    const config = (user?.aiProviderConfig as Record<string, unknown>) ?? {};
    return (config.assistantPermissions as AIPermissions) ?? {};
  }

  private async createConversation(userId: string, firstMessage: string) {
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
    return prisma.shoppingConversation.create({ data: { userId, title } });
  }

  private async getConversation(id: string, userId: string) {
    return prisma.shoppingConversation.findFirst({ where: { id, userId } });
  }

  private async getHistory(conversationId: string) {
    return prisma.shoppingMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });
  }

  private async saveMessage(
    conversationId: string,
    role: string,
    content: string,
    data?: Record<string, unknown>
  ) {
    await prisma.shoppingMessage.create({
      data: {
        conversationId,
        role,
        content,
        data: data ? JSON.parse(JSON.stringify(data)) : null,
      },
    });
    await prisma.shoppingConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }
}
