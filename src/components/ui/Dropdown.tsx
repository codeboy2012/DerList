'use client';

import { cn } from '@/utils/cn';
import { ChevronDown } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

export interface DropdownItem {
  label: ReactNode;
  value: string;
  disabled?: boolean;
  destructive?: boolean;
  icon?: ReactNode;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  onSelect?: (value: string) => void;
  align?: 'start' | 'end';
  label?: string;
  className?: string;
}

/**
 * Dropdown — accessible menu with full keyboard support.
 *
 * - ArrowDown/Up moves the active item
 * - Enter/Space selects
 * - Home/End jump to first/last
 * - Escape closes and returns focus to the trigger
 * - Click outside closes
 */
export function Dropdown({
  trigger,
  items,
  onSelect,
  align = 'start',
  label = 'Open menu',
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Reset active index when opening
  useEffect(() => {
    if (open) setActiveIndex(items.length > 0 ? 0 : -1);
  }, [open, items.length]);

  const handleTriggerKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
    },
    [],
  );

  const handleMenuKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIndex(items.length - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const item = items[activeIndex];
        if (item && !item.disabled) {
          onSelect?.(item.value);
          setOpen(false);
          triggerRef.current?.focus();
        }
      }
    },
    [activeIndex, items, onSelect],
  );

  return (
    <div ref={containerRef} className={cn('relative inline-block text-left', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKey}
        className="inline-flex items-center gap-2"
      >
        {trigger}
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          ref={(el) => {
            if (el && activeIndex >= 0) {
              const child = el.children.item(activeIndex) as HTMLElement | null;
              child?.focus();
            }
          }}
          id={menuId}
          role="menu"
          tabIndex={-1}
          onKeyDown={handleMenuKey}
          className={cn(
            'absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-xl',
            'focus:outline-none',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={item.value}
                type="button"
                role="menuitem"
                tabIndex={isActive ? 0 : -1}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  onSelect?.(item.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                  'transition-colors',
                  'focus:outline-none',
                  isActive ? 'bg-surface text-foreground' : 'text-foreground',
                  'hover:bg-surface',
                  item.disabled && 'cursor-not-allowed opacity-50',
                  item.destructive && 'text-danger hover:bg-danger/10',
                )}
              >
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const DropdownTrigger = (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...props} />
);

export const DropdownContent = (props: HTMLAttributes<HTMLDivElement>) => (
  <div role="menu" {...props} />
);
