'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/utils/cn';

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Want',
  2: 'Really Want',
  3: 'I NEED This',
  4: 'O.M.G. MUST HAVE!!',
};

interface WishlistPriorityProps {
  value: number;
  onChange: (value: number) => void;
  /** Show label text below stars */
  showLabel?: boolean;
  /** Size of stars */
  size?: 'sm' | 'md';
  /** Disable interaction (read-only) */
  disabled?: boolean;
}

/**
 * WishlistPriority — 4-star personal priority indicator.
 * NOT a review system — indicates how badly the user wants an item.
 */
export function WishlistPriority({
  value,
  onChange,
  showLabel = true,
  size = 'sm',
  disabled = false,
}: WishlistPriorityProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value;
  const iconSize = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className="inline-flex items-center gap-0.5"
        role="radiogroup"
        aria-label={`Priority: ${PRIORITY_LABELS[value] ?? 'Want'}`}
        onMouseLeave={() => setHoverValue(null)}
      >
        {[1, 2, 3, 4].map((star) => {
          const filled = star <= displayValue;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={star === value}
              aria-label={`${star} star${star > 1 ? 's' : ''}: ${PRIORITY_LABELS[star]}`}
              disabled={disabled}
              className={cn(
                'rounded-sm p-0.5 transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                !disabled && 'cursor-pointer hover:scale-110',
                disabled && 'cursor-default opacity-70',
              )}
              onClick={() => !disabled && onChange(star)}
              onMouseEnter={() => !disabled && setHoverValue(star)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' && value < 4) onChange(value + 1);
                if (e.key === 'ArrowLeft' && value > 1) onChange(value - 1);
              }}
            >
              <Star
                className={cn(
                  iconSize,
                  'transition-colors duration-150',
                  filled
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-transparent text-muted-foreground/40',
                )}
              />
            </button>
          );
        })}
      </div>
      {showLabel && (
        <span className="text-[10px] font-medium text-muted-foreground">
          {PRIORITY_LABELS[displayValue] ?? 'Want'}
        </span>
      )}
    </div>
  );
}

/**
 * Read-only priority display (no interaction).
 */
export function WishlistPriorityDisplay({ value, showLabel = false }: { value: number; showLabel?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <div className="inline-flex items-center gap-0.5" aria-label={`Priority: ${PRIORITY_LABELS[value] ?? 'Want'}`}>
        {[1, 2, 3, 4].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-3 w-3 transition-colors',
              star <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-transparent text-muted-foreground/30',
            )}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-[9px] text-muted-foreground">{PRIORITY_LABELS[value]}</span>
      )}
    </div>
  );
}

export { PRIORITY_LABELS };
