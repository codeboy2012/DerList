import { cn } from '@/utils/cn';
import { forwardRef, type HTMLAttributes } from 'react';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Reduce vertical padding. */
  compact?: boolean;
}

export const Section = forwardRef<HTMLElement, SectionProps>(
  ({ className, compact = false, ...props }, ref) => (
    <section
      ref={ref}
      className={cn(compact ? 'py-10 sm:py-14' : 'py-16 sm:py-24', className)}
      {...props}
    />
  ),
);
Section.displayName = 'Section';
