import { cn } from '@/utils/cn';
import { type ReactNode } from 'react';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

const sideMap = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
} as const;

/**
 * Tooltip — CSS-only. Works on focus and hover. Pure HTML/CSS,
 * no portal, no JS state, no runtime cost.
 *
 * For richer behaviour (delays, controlled open, escape-to-close),
 * replace with Radix UI Tooltip.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <span className={cn('group relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1',
          'text-xs text-foreground shadow-lg',
          'opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 group-focus-within:opacity-100',
          sideMap[side],
        )}
      >
        {content}
      </span>
    </span>
  );
}
