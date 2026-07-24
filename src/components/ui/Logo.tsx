import { cn } from '@/utils/cn';

interface LogoProps {
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Additional classes. */
  className?: string;
  /** Show the text label next to the icon. */
  showText?: boolean;
}

const sizes = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

/**
 * Official DerList logo component.
 * Uses the icon.png asset from public/icons/.
 */
export function Logo({ size = 'md', className, showText = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src="/icons/icon.png"
        alt="DerList"
        className={cn('rounded-lg', sizes[size])}
        width={size === 'lg' ? 48 : size === 'md' ? 32 : 24}
        height={size === 'lg' ? 48 : size === 'md' ? 32 : 24}
      />
      {showText && (
        <span className="text-sm font-semibold tracking-tight text-foreground">
          DerList
        </span>
      )}
    </span>
  );
}

/**
 * Icon-only version of the logo (no text).
 */
export function LogoIcon({ size = 'md', className }: Omit<LogoProps, 'showText'>) {
  return (
    <img
      src="/icons/icon.png"
      alt="DerList"
      className={cn('rounded-lg', sizes[size], className)}
      width={size === 'lg' ? 48 : size === 'md' ? 32 : 24}
      height={size === 'lg' ? 48 : size === 'md' ? 32 : 24}
    />
  );
}
