import { Slot } from '@/components/ui/Slot';
import { cn } from '@/utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

/**
 * Button is the primary call-to-action primitive.
 *
 * Variants follow the brand:
 *  - `primary`  : filled accent, used once per surface
 *  - `secondary`: subtle, used for supporting actions
 *  - `ghost`    : borderless, used inside dense lists
 *  - `outline`  : bordered, neutral
 *  - `danger`   : destructive actions
 *
 * Use `asChild` to render any element (e.g. <Link/>) as a button
 * while inheriting all styling and accessibility.
 */

const buttonVariants = cva(
  [
    // Layout
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    // Typography
    'text-sm font-medium',
    // Shape
    'rounded-lg',
    // Interaction
    'transition-colors',
    // Disabled
    'disabled:pointer-events-none disabled:opacity-50',
    // Focus
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-foreground hover:bg-accent/90 active:bg-accent/80',
        secondary:
          'bg-surface text-foreground border border-border hover:bg-card hover:border-border/80',
        ghost: 'text-foreground hover:bg-surface',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-surface',
        danger:
          'bg-danger text-white hover:bg-danger/90 active:bg-danger/80',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-4',
        lg: 'h-11 px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element as the button, ignoring the default <button>. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        // Default type only when rendering an actual <button>
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
