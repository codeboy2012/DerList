/**
 * DerList AI Module — Public API
 *
 * Exports the Shopping AI and Product Getter services for use
 * in server actions and API routes.
 */

export { chat, ask, type ChatMessage, type ShoppingAIResponse } from './shopping-ai';
export { parseProducts, parseImage, type ParsedProduct, type ProductGetterResult, type MatchedProduct } from './product-getter';
export { isPuterAvailable, puterChat, puterChatWithMedia, type AIMessage, type AIChatOptions, type AIChatResponse } from './puter';
