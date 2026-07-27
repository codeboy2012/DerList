/**
 * ProductPrice — Modern e-commerce price display.
 *
 * Features:
 * - Locale-aware formatting with commas ($1,551.69)
 * - Original price with strikethrough
 * - Discount badge (% OFF or SAVE $X)
 * - Currency shown only for non-USD
 * - Consistent height regardless of discount
 * - Never wraps, never overflows
 */

import { cn } from '@/utils/cn';

interface ProductPriceProps {
  /** Current/sale price */
  price: number;
  /** Original/list price (shown struck through if higher than price) */
  originalPrice?: number | null;
  /** Currency code */
  currency?: string;
  /** Deal text override (e.g. "Lightning Deal") */
  dealInfo?: string | null;
  /** Whether item is purchased (dims the price) */
  purchased?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function ProductPrice({
  price,
  originalPrice,
  currency = 'USD',
  dealInfo,
  purchased = false,
  size = 'md',
}: ProductPriceProps) {
  const hasDiscount = originalPrice != null && originalPrice > price;
  const discountPercent = hasDiscount
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;
  const savingsAmount = hasDiscount ? originalPrice - price : 0;

  const priceText = formatPrice(price, currency);
  const originalText = hasDiscount ? formatPrice(originalPrice, currency) : '';

  // Show currency code only for non-USD
  const showCurrencyCode = currency !== 'USD';

  const sizeClasses = {
    sm: 'text-base',
    md: 'text-xl sm:text-2xl',
    lg: 'text-2xl sm:text-3xl',
  };

  return (
    <div
      className="flex flex-col items-end gap-0.5"
      style={{ minHeight: size === 'sm' ? '36px' : '48px' }}
    >
      {/* Current price */}
      <div className="flex items-baseline gap-1.5">
        {showCurrencyCode && (
          <span className="text-muted-foreground text-[10px] font-medium uppercase">
            {currency}
          </span>
        )}
        <span
          className={cn(
            'leading-none font-extrabold tracking-tight whitespace-nowrap',
            'tabular-nums',
            sizeClasses[size],
            purchased ? 'text-muted-foreground' : 'text-foreground'
          )}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {priceText}
        </span>
      </div>

      {/* Original price (strikethrough) */}
      {hasDiscount && (
        <span className="text-muted-foreground text-[11px] leading-none whitespace-nowrap tabular-nums line-through">
          {originalText}
        </span>
      )}

      {/* Discount badge */}
      {(hasDiscount || dealInfo) && (
        <span className="mt-0.5 inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] leading-none font-semibold whitespace-nowrap text-emerald-400">
          {dealInfo ||
            (discountPercent >= 5
              ? `${discountPercent}% OFF`
              : `SAVE ${formatPrice(savingsAmount, currency)}`)}
        </span>
      )}
    </div>
  );
}
