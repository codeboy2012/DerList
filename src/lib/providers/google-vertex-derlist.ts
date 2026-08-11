/**
 * Google Vertex AI – DerList Provider
 *
 * A preconfigured Google Vertex AI provider with the DerList Shopping AI
 * system instruction. When this provider is selected and configured, AI
 * requests include the DerList shopping-optimized system prompt.
 *
 * This provider:
 * - Uses the same Vertex AI infrastructure as the generic google-vertex provider
 * - Automatically injects the DerList Shopping AI system instruction
 * - Uses the configured model (or defaults to gemini-2.5-flash)
 * - Is entirely optional — if not configured, other providers work normally
 * - Never activates unless explicitly configured AND selected by the user
 */

import type { AIOptions, AIProvider, AIResponse, Message } from './types';
import { GoogleVertexProvider } from './google-vertex';

// ─────────────────────────────────────────────────────────────────────────────
// DerList Shopping AI System Instruction
// ─────────────────────────────────────────────────────────────────────────────

const DERLIST_SHOPPING_SYSTEM_INSTRUCTION = `You are DerList Shopping AI.

IDENTITY:
You are DerList Shopping AI, a shopping research and deal-finding assistant.

GOAL:
Find the best legitimate product matching the user's requirements at the lowest trustworthy total cost.

CONDITION:
Default to NEW only. Used, refurbished, renewed, or open-box products are allowed ONLY when the user explicitly permits them.

SELLERS:
Prefer manufacturers, major retailers, authorized sellers, and reputable marketplaces. Avoid suspicious, counterfeit-prone, unclear, or unreliable sellers. Never sacrifice trust for a lower price.

PRICE:
Compare legitimate sellers when possible. Consider item price, shipping, mandatory fees, required accessories, memberships, and known discounts.

Never invent:
- prices
- availability
- specifications
- sellers
- reviews
- shipping
- warranties
- URLs
- discounts

Do not claim "lowest price" without evidence.

PRODUCTS:
Verify the exact model, generation, variant, configuration, specifications, included accessories, region, and compatibility. Do not treat different variants as identical.

DEALS:
Evaluate seller trust, condition, product identity, market price, warranty, returns, missing accessories, misleading discounts, and suspicious pricing.

RULES:
Follow explicit user requirements and budgets.

"Cheapest" means the cheapest trustworthy qualifying option.

"Best" means the best overall fit and value.

If no trustworthy option qualifies, say so.

AUTHENTICITY:
Be cautious with commonly counterfeited products. Never claim authenticity without sufficient evidence.

TRANSPARENCY:
Distinguish verified facts from uncertainty. Never present guesses as facts.

RESPONSE:
Be concise and useful.

When useful, identify:
BEST MATCH
LOWEST TRUSTWORTHY PRICE
BEST VALUE`;

// ─────────────────────────────────────────────────────────────────────────────
// Provider Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class GoogleVertexDerListProvider implements AIProvider {
  readonly id = 'google-vertex-derlist';
  readonly name = 'Google Vertex AI – DerList';

  private readonly vertexProvider: GoogleVertexProvider;

  constructor(vertexProvider: GoogleVertexProvider) {
    this.vertexProvider = vertexProvider;
  }

  isAvailable(): boolean {
    return this.vertexProvider.isAvailable();
  }

  async chat(messages: Message[], options?: AIOptions): Promise<AIResponse> {
    // Inject the DerList system instruction if no system message is already present
    const hasSystemMessage = messages.some((m) => m.role === 'system');

    const augmentedMessages: Message[] = hasSystemMessage
      ? messages
      : [{ role: 'system', content: DERLIST_SHOPPING_SYSTEM_INSTRUCTION }, ...messages];

    return this.vertexProvider.chat(augmentedMessages, options);
  }
}

/**
 * Create a Google Vertex AI – DerList provider from config.
 * Returns null if required config (projectId + auth) is missing.
 */
export function createGoogleVertexDerListProvider(
  config: Record<string, unknown>
): GoogleVertexDerListProvider | null {
  const projectId = config.projectId as string | undefined;
  if (!projectId) return null;

  const apiKey = config.apiKey as string | undefined;
  const serviceAccountJson = config.serviceAccountJson as string | undefined;

  if (!apiKey && !serviceAccountJson) return null;

  const vertexProvider = new GoogleVertexProvider({
    projectId,
    region: (config.region as string) || undefined,
    apiKey,
    serviceAccountJson,
    model: (config.model as string) || undefined,
  });

  return new GoogleVertexDerListProvider(vertexProvider);
}
