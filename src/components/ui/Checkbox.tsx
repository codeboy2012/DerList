import { cn } from '@/utils/cn';
import { Check } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const reactId = id ?? props.name;
    return (
      <label
        htmlFor={reactId}
        className={cn(
          'group inline-flex cursor-pointer items-start gap-3',
          'text-sm text-foreground',
          'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50',
          className,
        )}
      >
        <span className="relative mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={reactId}
            type="checkbox"
            className={cn(
              'peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded border border-border bg-surface',
              'transition-colors',
              'checked:border-accent checked:bg-accent',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'disabled:cursor-not-allowed',
            )}
            {...props}
          />
          <Check
            className="pointer-events-none h-3 w-3 text-accent-foreground opacity-0 transition-opacity peer-checked:opacity-100"
            strokeWidth={3}
            aria-hidden
          />
        </span>
        {(label || description) && (
          <span className="flex flex-col gap-0.5">
            {label && <span className="font-medium leading-none">{label}</span>}
            {description && (
              <span className="text-xs text-muted-foreground">{description}</span>
            )}
          </span>
        )}
      </label>
    );
  },
);
Checkbox.displayName = 'Checkbox';
