/**
 * Shopping AI Service — Puter.js orchestration with tool calling.
 *
 * Architecture:
 *   User message → Puter.js AI → Tool calls → DerList Tools → Response
 *
 * The AI never accesses the database directly. It can only use the controlled
 * tools defined in tool-definitions.ts, which wrap safe Prisma queries.
 *
 * DerList remains the source of truth for all product data.
 */

import { getPuter } from './puter';
import { SHOPPING_AI_TOOLS } from './tool-definitions';
import * as tools from './tools';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ShoppingAIResponse {
  success: boolean;
  message: string;
  messages: ChatMessage[];
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are DerList's Shopping AI — a helpful, knowledgeable shopping assistant.

Your role:
- Help users find products, compare options, check prices, and manage their wishlists.
- Use the available tools to search DerList's product database for real information.
- NEVER hallucinate product prices, availability, specifications, URLs, or retailers.
- If DerList doesn't have information about a product, say so clearly.

Rules:
1. ALL product information (prices, specs, availability) MUST come from tool results.
2. Never invent product details. If a search returns no results, tell the user.
3. When recommending products, show the star priority system: ⭐=Want, ⭐⭐=Really Want, ⭐⭐⭐=Need This, ⭐⭐⭐⭐=Must Have!
4. Always confirm with the user before adding items to their wishlist.
5. Format prices as currency values (e.g., $129.99).
6. When showing multiple products, format them clearly with name, price, and key details.
7. For compatibility questions, use check_compatibility and reason about the specs returned.
8. If asked about a product not in DerList's database, suggest the user import it via URL.

Personality:
- Knowledgeable but approachable — like a tech-savvy friend who loves finding deals.
- Concise responses. Don't over-explain unless asked.
- Use the star rating naturally: "This is definitely a ⭐⭐⭐⭐ Must Have!"`;

// ─────────────────────────────────────────────────────────────────────────────
// Tool Executor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a tool call and return the result as a string.
 */
async function executeTool(name: string, args: Record<string, unknown>, userId: string): Promise<string> {
  let result: tools.ToolResult;

  switch (name) {
    case 'search_products':
      result = await tools.searchProducts(args as Parameters<typeof tools.searchProducts>[0]);
      break;
    case 'get_product':
      result = await tools.getProduct(args as Parameters<typeof tools.getProduct>[0]);
      break;
    case 'compare_products':
      result = await tools.compareProducts(args as Parameters<typeof tools.compareProducts>[0]);
      break;
    case 'find_similar_products':
      result = await tools.findSimilarProducts(args as Parameters<typeof tools.findSimilarProducts>[0]);
      break;
    case 'check_compatibility':
      result = await tools.checkCompatibility(args as Parameters<typeof tools.checkCompatibility>[0]);
      break;
    case 'get_price_history':
      result = await tools.getPriceHistory(args as Parameters<typeof tools.getPriceHistory>[0]);
      break;
    case 'add_to_wishlist':
      result = await tools.addToWishlist({ ...args, userId } as Parameters<typeof tools.addToWishlist>[0]);
      break;
    case 'update_wishlist_item':
      result = await tools.updateWishlistItem({ ...args, userId } as Parameters<typeof tools.updateWishlistItem>[0]);
      break;
    case 'get_user_wishlists':
      result = await tools.getUserWishlists({ userId });
      break;
    default:
      result = { success: false, error: `Unknown tool: ${name}` };
  }

  return JSON.stringify(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Chat Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a message to the Shopping AI and get a response.
 * Handles multi-turn tool calling automatically (up to 5 rounds).
 *
 * @param userMessage - The user's message
 * @param conversationHistory - Previous messages for context
 * @param userId - Authenticated user ID (for ownership verification on writes)
 * @param model - AI model to use (default: gpt-4o)
 */
export async function chat(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  userId: string,
  model = 'gpt-4o',
): Promise<ShoppingAIResponse> {
  const puter = getPuter();
  if (!puter) {
    return {
      success: false,
      message: '',
      messages: [],
      error: 'Shopping AI is not configured. Set PUTER_AUTH_TOKEN in your environment.',
    };
  }

  // Build messages array
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  const maxToolRounds = 5;
  const currentMessages: ChatMessage[] = [...messages];

  for (let round = 0; round < maxToolRounds; round++) {
    try {
      const response = await puter.ai.chat(currentMessages, {
        model,
        tools: SHOPPING_AI_TOOLS as unknown as unknown[],
      });

      const assistantMessage = response.message;

      // If AI responds with text (no tool calls), we're done
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        const content = typeof assistantMessage.content === 'string'
          ? assistantMessage.content
          : Array.isArray(assistantMessage.content)
            ? assistantMessage.content.map((c: { text?: string }) => c.text ?? '').join('')
            : String(assistantMessage.content ?? '');

        currentMessages.push({ role: 'assistant', content });
        return {
          success: true,
          message: content,
          messages: currentMessages,
        };
      }

      // AI wants to call tools — execute them
      currentMessages.push({
        role: 'assistant',
        content: assistantMessage.content ?? '',
        tool_calls: assistantMessage.tool_calls,
      });

      for (const toolCall of assistantMessage.tool_calls) {
        const args = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;

        const toolResult = await executeTool(toolCall.function.name, args, userId);

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      // Continue loop — send tool results back to AI for final response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'AI service error';
      return {
        success: false,
        message: '',
        messages: currentMessages,
        error: `Shopping AI error: ${errorMessage}`,
      };
    }
  }

  // If we hit max rounds, return what we have
  return {
    success: false,
    message: '',
    messages: currentMessages,
    error: 'Shopping AI exceeded maximum tool-calling rounds. Please try a simpler request.',
  };
}

/**
 * Quick one-shot question (no conversation history).
 */
export async function ask(
  question: string,
  userId: string,
  model?: string,
): Promise<ShoppingAIResponse> {
  return chat(question, [], userId, model);
}
