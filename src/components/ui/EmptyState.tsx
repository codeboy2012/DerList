import { cn } from '@/utils/cn';
import { type ReactNode } from 'react';

export interface EmptyStateProps {
  /** Icon or illustration. */
  icon?: ReactNode;
  /** Primary heading. */
  title: string;
  /** Supporting description text. */
  description?: string;
  /** CTA button or link. */
  action?: ReactNode;
  /** Additional class names. */
  className?: string;
  /** Visual size variant. */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * EmptyState — premium empty state component with subtle animation.
 * Used when a list, table, or region has no data to display.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  const paddings = { sm: 'p-6', md: 'p-10', lg: 'py-16 px-10' };
  const iconSizes = { sm: 'h-10 w-10', md: 'h-14 w-14', lg: 'h-16 w-16' };
  const titleSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border text-center animate-fade-up',
        paddings[size],
        className,
      )}
    >
      {icon && (
        <div className={cn(
          'flex items-center justify-center rounded-2xl bg-surface/80 text-muted-foreground/40',
          iconSizes[size],
        )}>
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h3 className={cn('font-semibold text-foreground', titleSizes[size])}>
          {title}
        </h3>
        {description && (
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
