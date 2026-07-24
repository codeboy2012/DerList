import { cn } from '@/utils/cn';
import { forwardRef, type HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Width/height as Tailwind classes or arbitrary values. */
  size?: string;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, size, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className={cn('animate-pulse rounded-md bg-surface', size, className)}
      {...props}
    />
  ),
);
Skeleton.displayName = 'Skeleton';
