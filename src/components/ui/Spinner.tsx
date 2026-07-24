import { cn } from '@/utils/cn';
import { Loader2 } from 'lucide-react';
import type { HTMLAttributes } from 'react';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
} as const;

export function Spinner({ size = 'md', label = 'Loading', className, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn('inline-flex items-center justify-center text-muted-foreground', className)}
      {...props}
    >
      <Loader2 className={cn('animate-spin', sizeMap[size])} aria-hidden />
    </span>
  );
}
