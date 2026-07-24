import { cn } from '@/utils/cn';
import { forwardRef, type HTMLAttributes } from 'react';

export const Container = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)}
      {...props}
    />
  ),
);
Container.displayName = 'Container';
