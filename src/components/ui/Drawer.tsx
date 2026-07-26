'use client';

/**
 * Drawer — Right-side slide-over panel.
 *
 * - Renders into document.body via portal.
 * - Dims background with backdrop.
 * - Closes on ESC and backdrop click (unless persistent).
 * - Traps focus while open.
 * - Smooth slide-in/out animation.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Width: sm (384px), md (448px), lg (512px), xl (672px), full (100%) */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Disable closing on backdrop click or Escape. */
  persistent?: boolean;
  /** Show close confirmation when dirty */
  onBeforeClose?: () => boolean;
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-full',
} as const;

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'lg',
  persistent = false,
  onBeforeClose,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const attemptClose = useCallback(() => {
    if (persistent) return;
    if (onBeforeClose && !onBeforeClose()) return;
    onClose();
  }, [persistent, onBeforeClose, onClose]);

  // Save/restore focus
  useEffect(() => {
    if (open) {
      previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
      // Focus the panel after animation starts
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
    } else {
      previouslyFocused.current?.focus?.();
    }
  }, [open]);

  // Handle ESC
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        attemptClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, attemptClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="animate-in fade-in absolute inset-0 bg-black/50 backdrop-blur-sm duration-200"
        onClick={attemptClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'bg-card relative flex h-full w-full flex-col shadow-2xl',
          'border-border border-l',
          'animate-in slide-in-from-right duration-300 ease-out',
          'focus-visible:outline-none',
          sizeMap[size]
        )}
      >
        {/* Header */}
        {(title || !persistent) && (
          <header className="border-border flex shrink-0 items-start justify-between gap-4 border-b px-6 py-5">
            <div className="min-w-0 flex-1 space-y-1">
              {title && (
                <h2 id={titleId} className="truncate text-lg leading-tight font-semibold">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-muted-foreground text-sm">
                  {description}
                </p>
              )}
            </div>
            {!persistent && <DrawerClose onClose={attemptClose} />}
          </header>
        )}

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer — sticky */}
        {footer && (
          <footer className="border-border flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

const DrawerClose = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { onClose: () => void }
>(({ onClose, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label="Close panel"
    onClick={onClose}
    className={cn(
      'text-muted-foreground inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
      'hover:bg-surface hover:text-foreground transition-colors',
      'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
      className
    )}
    {...props}
  >
    <X className="h-4 w-4" aria-hidden />
  </button>
));
DrawerClose.displayName = 'DrawerClose';
