/**
 * formatDiscount — Shared utility for consistent discount badge rendering.
 *
 * Priority:
 * 1. Percentage discount (preferred) when both prices are known
 * 2. Dollar savings when both prices exist but % is < 1
 * 3. Parse dealInfo string if it already contains context (e.g. "43% OFF", "Save $100")
 * 4. Return null if no meaningful discount can be determined
 *
 * Never returns raw numbers like "49.01" or "630.00".
 */

export interface DiscountResult {
  label: string;
  type: 'percent' | 'amount';
}

interface FormatDiscountInput {
  currentPrice?: number | null;
  originalPrice?: number | null;
  /** Raw deal info from scraping — may be a number, percentage, or formatted string */
  dealInfo?: string | null;
  currency?: string;
}

/**
 * Format a discount for display as a badge.
 *
 * Returns `null` if there is no discount or it cannot be meaningfully formatted.
 */
export function formatDiscount({
  currentPrice,
  originalPrice,
  dealInfo,
  currency = 'USD',
}: FormatDiscountInput): DiscountResult | null {
  // 1. Calculate from prices if both exist
  if (
    currentPrice != null &&
    originalPrice != null &&
    originalPrice > currentPrice &&
    originalPrice > 0
  ) {
    const percent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    const savings = originalPrice - currentPrice;

    if (percent >= 1) {
      return { label: `${percent}% OFF`, type: 'percent' };
    }

    if (savings >= 0.01) {
      return { label: `Save ${formatCurrency(savings, currency)}`, type: 'amount' };
    }
  }

  // 2. Parse dealInfo if provided
  if (dealInfo && dealInfo.trim()) {
    const parsed = parseDealInfo(dealInfo.trim(), currency);
    if (parsed) return parsed;
  }

  return null;
}

/**
 * Parse a raw dealInfo string into a formatted discount.
 * Returns null if the value is just a raw number with no context.
 */
function parseDealInfo(raw: string, currency: string): DiscountResult | null {
  // Already formatted: "43% OFF", "22% Off", "50% off"
  if (/\d+%\s*off/i.test(raw)) {
    const match = raw.match(/(\d+)%/);
    if (match) {
      return { label: `${match[1]}% OFF`, type: 'percent' };
    }
  }

  // Already formatted: "Save $100", "SAVE $49.99"
  if (/save\s*\$[\d,.]+/i.test(raw)) {
    return { label: raw.trim(), type: 'amount' };
  }

  // Percentage without "off": "43%", "22%"
  if (/^\d+%$/.test(raw)) {
    const num = parseInt(raw, 10);
    if (num >= 1 && num <= 99) {
      return { label: `${num}% OFF`, type: 'percent' };
    }
  }

  // Text labels that are already meaningful
  if (/deal|sale|clearance|limited|lightning|prime|coupon/i.test(raw)) {
    return { label: raw, type: 'amount' };
  }

  // Raw number (the problematic case) — try to interpret as savings amount
  const numericValue = parseFloat(raw.replace(/[,$]/g, ''));
  if (!isNaN(numericValue) && isFinite(numericValue) && numericValue > 0) {
    // This is a raw savings amount like "49.01" — format it properly
    return { label: `Save ${formatCurrency(numericValue, currency)}`, type: 'amount' };
  }

  // Unrecognized format — return null to suppress the badge
  return null;
}

/**
 * Format a number as US currency.
 */
function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
