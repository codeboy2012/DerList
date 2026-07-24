import { cn } from '@/utils/cn';
import { forwardRef, type HTMLAttributes } from 'react';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const sizeMap: Record<Size, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-lg',
};

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: Size;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ src, alt, name = '', size = 'md', className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-full bg-surface font-medium text-foreground ring-1 ring-border',
          sizeMap[size],
          className,
        )}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt ?? name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span aria-label={alt ?? name}>{getInitials(name || 'User')}</span>
        )}
      </span>
    );
  },
);
Avatar.displayName = 'Avatar';
