'use client';

import { cn } from '@/utils/cn';
import { X } from 'lucide-react';
import {
  forwardRef,
  type MouseEvent,
  type ReactNode,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Disable closing on backdrop click or Escape. */
  persistent?: boolean;
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
} as const;

/**
 * Modal — accessible dialog built on the native <dialog> element.
 *
 * - Renders into document.body via portal so stacking contexts
 *   and transforms don't trap it.
 * - Trap focus within the dialog while open.
 * - Restore focus to the trigger on close.
 * - Close on Escape and on backdrop click (unless persistent).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  persistent = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Sync open state with the native <dialog> element
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Cleanup focus on unmount
  useEffect(() => {
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  // Handle the native `cancel` event (Escape) and backdrop clicks.
  // We need to attach via React props because dialog is uncontrolled here.
  const handleCancel = (e: { preventDefault: () => void }) => {
    if (persistent) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    onClose();
  };

  const handleClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (persistent) return;
    // Native <dialog> has a synthetic backdrop. Click on dialog itself with
    // target === dialog means click was on the backdrop.
    if (e.target === dialogRef.current) {
      const rect = dialogRef.current.getBoundingClientRect();
      const inDialog =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inDialog) onClose();
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleClick}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      className={cn(
        'm-0 max-h-[90vh] w-[92vw] p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm',
        'rounded-xl border border-border bg-card text-card-foreground shadow-2xl',
        'fixed inset-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        sizeMap[size],
        'open:animate-in open:fade-in-0 open:zoom-in-95',
      )}
    >
      <div className="flex max-h-[90vh] flex-col">
        {(title || !persistent) && (
          <header className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div className="space-y-1">
              {title && (
                <h2 id={titleId} className="text-lg font-semibold leading-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {!persistent && (
              <ModalClose onClose={onClose} />
            )}
          </header>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-border p-5">
            {footer}
          </footer>
        )}
      </div>
    </dialog>,
    document.body,
  );
}

const ModalClose = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { onClose: () => void }
>(({ onClose, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label="Close dialog"
    onClick={onClose}
    className={cn(
      'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground',
      'transition-colors hover:bg-surface hover:text-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className,
    )}
    {...props}
  >
    <X className="h-4 w-4" aria-hidden />
  </button>
));
ModalClose.displayName = 'ModalClose';

// Dialog is the same as Modal but always non-dismissable (e.g. forced actions)
export interface DialogProps extends Omit<ModalProps, 'persistent'> {}

export function Dialog(props: DialogProps) {
  return <Modal {...props} persistent />;
}

// Helper hook for managing open state
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  return {
    open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    onToggle: () => setOpen((o) => !o),
  };
}

// Re-export the panel container used inside the dialog body
export const DialogBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('space-y-4', className)} {...props} />
);
