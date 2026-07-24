import { cn } from '@/utils/cn';
import { forwardRef, type HTMLAttributes } from 'react';

type Gap = 'sm' | 'md' | 'lg' | 'xl';
type Cols = 1 | 2 | 3 | 4 | 6 | 12;

const gapMap: Record<Gap, string> = {
  sm: 'gap-3',
  md: 'gap-4 sm:gap-6',
  lg: 'gap-6 sm:gap-8',
  xl: 'gap-8 sm:gap-10',
};

const colsMap: Record<Cols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  12: 'grid-cols-4 sm:grid-cols-8 lg:grid-cols-12',
};

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: Cols;
  gap?: Gap;
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(
  ({ className, cols = 3, gap = 'md', ...props }, ref) => (
    <div ref={ref} className={cn('grid', colsMap[cols], gapMap[gap], className)} {...props} />
  ),
);
Grid.displayName = 'Grid';
