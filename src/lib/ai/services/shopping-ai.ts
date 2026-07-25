/**
 * Shopping AI Service — Multi-provider AI orchestration with tool calling.
 *
 * Architecture:
 *   User message → AI Provider → Tool calls → DerList Tools → Response
 *
 * The AI never accesses the database directly. It can only use the controlled
 * tools defined in tool-definitions.ts, which wrap safe Prisma queries.
 *
 * DerList remains the source of truth for all product data.
 */

import { getAIProvider, type AIMessage } from '../providers';
import { SHOPPING_AI_TOOLS } from '../tool-definitions';
import * as tools from '../tools';

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

Guidelines:
- Be conversational and helpful, but stay focused on shopping assistance.
- Ask clarifying questions when user requests are vague.
- Suggest alternatives when specific products aren't available.
- Help users make informed purchasing decisions with available data.
- If you can't find something in DerList, suggest they add it manually or try different search terms.

Available tools let you:
- Search products in the DerList database
- Get user's wishlist contents
- Add items to wishlists
- Find product details and pricing

Remember: Only use information returned by your tools. Do not invent or assume product details.`;

// ─────────────────────────────────────────────────────────────────────────────
// Main Chat Function
// ─────────────────────────────────────────────────────────────────────────────

export async function chat(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  userId: string,
  model = 'gpt-4o',
): Promise<ShoppingAIResponse> {
  try {
    // Get AI provider for this user
    const provider = await getAIProvider(userId, 'serpapi'); // fallback to recommended
    
    // Build messages array
    const messages: AIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.map(msg => ({
        role: msg.role as AIMessage['role'],
        content: msg.content,
        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
        ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
      })),
      { role: 'user', content: userMessage },
    ];

    const maxToolRounds = 5;
    const currentMessages: AIMessage[] = [...messages];

    for (let round = 0; round < maxToolRounds; round++) {
      const response = await provider.chat(currentMessages, {
        model,
        tools: SHOPPING_AI_TOOLS as unknown as any[],
      });

      const assistantMessage = response.message;

      // If AI responds with text (no tool calls), we're done
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        const content = assistantMessage.content || '';

        currentMessages.push({ role: 'assistant', content });
        return {
          success: true,
          message: content,
          messages: currentMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
            ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
            ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
          })),
        };
      }

      // AI wants to call tools — execute them
      const toolMsgContent = assistantMessage.content || '';

      currentMessages.push({
        role: 'assistant',
        content: toolMsgContent,
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
    }

    // If we've hit the max tool rounds, return what we have
    return {
      success: false,
      message: '',
      messages: currentMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
        ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
      })),
      error: 'Maximum tool calling rounds exceeded. The AI may need more specific guidance.',
    };

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'AI service error';
    return {
      success: false,
      message: '',
      messages: [],
      error: `Shopping AI error: ${errorMessage}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Execution
// ─────────────────────────────────────────────────────────────────────────────

async function executeTool(toolName: string, args: any, userId: string): Promise<string> {
  try {
    switch (toolName) {
      case 'search_products':
        return JSON.stringify(await tools.searchProducts({ 
          query: args.query,
          maxResults: args.limit || 10 
        }));
        
      case 'get_user_wishlists':
        return JSON.stringify(await tools.getUserWishlists({ userId }));
        
      case 'add_item_to_wishlist':
        return JSON.stringify(await tools.addToWishlist({ 
          wishlistId: args.wishlistId,
          productId: args.productId,
          userId 
        }));
        
      case 'get_product_details':
        return JSON.stringify(await tools.getProduct({ productId: args.productId }));
        
      case 'get_price_history':
        return JSON.stringify(await tools.getPriceHistory({ 
          productId: args.productId,
          limit: args.days || 30 
        }));
        
      case 'find_similar_products':
        return JSON.stringify(await tools.findSimilarProducts({ 
          productId: args.productId,
          maxResults: args.limit || 5 
        }));

      case 'compare_products':
        return JSON.stringify(await tools.compareProducts({ 
          productIds: args.productIds 
        }));
        
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    return JSON.stringify({ 
      error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quick ask function for simple questions without conversation history
 */
export async function ask(
  question: string,
  userId: string,
  model?: string,
): Promise<ShoppingAIResponse> {
  return chat(question, [], userId, model);
}

/**
 * Check if Shopping AI is available for a user
 */
export async function isShoppingAIAvailable(userId: string): Promise<boolean> {
  try {
    const provider = await getAIProvider(userId);
    return provider.id !== null;
  } catch (error) {
    return false;
  }
}