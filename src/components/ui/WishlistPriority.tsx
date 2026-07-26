'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Star } from 'lucide-react';
import { cn } from '@/utils/cn';

/** Short labels shown inline next to stars */
const PRIORITY_LABELS: Record<number, string> = {
  1: 'Want',
  2: 'Really Want',
  3: 'Need This',
  4: 'Must Have!',
};

interface WishlistPriorityProps {
  value: number;
  onChange: (value: number) => void;
  /** Show label text next to stars */
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
  const [sparkle, setSparkle] = useState(false);
  const [justSelected, setJustSelected] = useState<number | null>(null);
  const displayValue = hoverValue ?? value;
  const iconSize = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const sparkleTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (sparkleTimeout.current) clearTimeout(sparkleTimeout.current);
    };
  }, []);

  const handleSelect = (star: number) => {
    if (disabled) return;
    onChange(star);

    // Pop animation feedback
    setJustSelected(star);
    setTimeout(() => setJustSelected(null), 200);

    // Mobile haptic feedback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }

    // Sparkle animation for max priority
    if (star === 4) {
      setSparkle(true);
      if (sparkleTimeout.current) clearTimeout(sparkleTimeout.current);
      sparkleTimeout.current = setTimeout(() => setSparkle(false), 600);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className="relative inline-flex items-center gap-0.5"
        role="radiogroup"
        aria-label={`Priority: ${PRIORITY_LABELS[value] ?? 'Want'}`}
        onMouseLeave={() => setHoverValue(null)}
      >
        {[1, 2, 3, 4].map((star) => {
          const filled = star <= displayValue;
          const isPopping = justSelected !== null && star <= justSelected;
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
                'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
                !disabled && 'cursor-pointer hover:scale-110',
                disabled && 'cursor-default opacity-70',
                isPopping && 'scale-125'
              )}
              onClick={() => handleSelect(star)}
              onMouseEnter={() => !disabled && setHoverValue(star)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' && value < 4) handleSelect(value + 1);
                if (e.key === 'ArrowLeft' && value > 1) handleSelect(value - 1);
              }}
            >
              <Star
                className={cn(
                  iconSize,
                  'transition-all duration-150',
                  filled
                    ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_3px_rgba(250,204,21,0.4)]'
                    : 'text-muted-foreground/40 fill-transparent'
                )}
              />
            </button>
          );
        })}

        {/* Sparkle animation for 4-star selection */}
        {sparkle && (
          <span className="pointer-events-none absolute -top-1 -right-1 animate-ping">
            <Sparkles className="h-3 w-3 text-yellow-300" />
          </span>
        )}
      </div>

      {showLabel && (
        <span
          className={cn(
            'text-muted-foreground font-medium transition-all duration-150',
            size === 'md' ? 'text-xs' : 'text-[10px]',
            displayValue === 4 && 'text-yellow-400/90'
          )}
        >
          {PRIORITY_LABELS[displayValue] ?? 'Want'}
        </span>
      )}
    </div>
  );
}

/**
 * Read-only priority display (no interaction).
 * Shows stars + label inline.
 */
export function WishlistPriorityDisplay({
  value,
  showLabel = true,
}: {
  value: number;
  showLabel?: boolean;
}) {
  return (
    <div
      className="inline-flex items-center gap-1.5"
      aria-label={`Priority: ${PRIORITY_LABELS[value] ?? 'Want'}`}
    >
      <div className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-3 w-3',
              star <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground/30 fill-transparent'
            )}
          />
        ))}
      </div>
      {showLabel && (
        <span
          className={cn(
            'text-muted-foreground text-[10px] font-medium',
            value === 4 && 'text-yellow-400/90'
          )}
        >
          {PRIORITY_LABELS[value]}
        </span>
      )}
    </div>
  );
}

export { PRIORITY_LABELS };
