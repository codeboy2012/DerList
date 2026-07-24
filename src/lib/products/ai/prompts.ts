/**
 * AI Verification Prompts — structured prompts for LLM price/product verification.
 */

export const VERIFY_PRICE_PROMPT = `You are a price verification assistant. Analyze the following product page data and determine if the extracted price is correct.

Extracted Price: $PRICE$ $CURRENCY$
Product URL: $URL$

Key points to check:
- Is this the CURRENT selling price (not a savings amount, not "Save $X")?
- Is this the main product price (not an accessory, add-on, or protection plan)?
- Is this NOT a monthly payment/financing amount?
- Is this NOT a coupon discount value?

Product page data (first 15000 chars):
$HTML$

Return ONLY a JSON object:
{
  "isCorrect": true/false,
  "suggestedPrice": number or null,
  "currency": "USD" or appropriate currency code,
  "confidence": 0-100,
  "reason": "brief explanation"
}`;

/**
 * Prepare HTML for AI consumption — truncate and focus on price-related content.
 */
export function prepareHtmlForAI(html: string, maxLength: number = 15000): string {
  // Remove scripts, styles, and other noise
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ');

  // Preserve JSON-LD (highly useful for AI)
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  let prefix = '';
  if (jsonLdMatch) {
    prefix = '=== Structured Data ===\n' + jsonLdMatch.join('\n') + '\n\n=== HTML ===\n';
  }

  const available = maxLength - prefix.length;
  if (cleaned.length > available) {
    cleaned = cleaned.slice(0, available) + '\n[truncated]';
  }

  return prefix + cleaned;
}
