'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

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
  const menuRef = useRef<HTMLDivElement>(null);
  // Space activates a focused button on keyup. Restoring focus to the trigger
  // during the Space keydown would therefore re-open the menu it just closed,
  // so the restore waits for that keyup instead.
  const restoreFocusOnKeyUp = useRef(false);
  const menuId = useId();
  // Disabled states change while the menu is open (for example when a pending
  // action finishes). If the stored index is gone or still disabled, resolve
  // the roving target to the first enabled item during render so Enter/Space
  // keep working without needing a synchronising effect.
  const activeItem = items[activeIndex];
  const effectiveIndex =
    activeItem && !activeItem.disabled ? activeIndex : items.findIndex((item) => !item.disabled);

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

  // Restore focus after a Space-activated menu item has closed the menu.
  useEffect(() => {
    const handleKeyUp = (e: globalThis.KeyboardEvent) => {
      if (e.key !== ' ' || !restoreFocusOnKeyUp.current) return;
      restoreFocusOnKeyUp.current = false;
      e.preventDefault();
      triggerRef.current?.focus();
    };
    document.addEventListener('keyup', handleKeyUp);
    return () => document.removeEventListener('keyup', handleKeyUp);
  }, []);

  // Open on the first selectable item. The first item is often disabled (for
  // example "Move up" on the first collection), and a disabled button cannot
  // receive focus.
  const openMenu = useCallback(() => {
    setActiveIndex(items.findIndex((item) => !item.disabled));
    setOpen(true);
  }, [items]);

  const moveActive = useCallback(
    (delta: 1 | -1) => {
      setActiveIndex((current) => {
        if (items.length === 0) return -1;
        // Start from a valid entry even if the stored index is stale.
        let next = items[current] && !items[current].disabled ? current : delta === 1 ? -1 : 0;
        for (let step = 0; step < items.length; step += 1) {
          next = (next + delta + items.length) % items.length;
          const candidate = items[next];
          if (candidate && !candidate.disabled) return next;
        }
        return current;
      });
    },
    [items]
  );

  // Move focus into the menu itself once it opens. Focusing the menu container
  // (rather than a child) keeps keyboard handling reliable even when the first
  // item is disabled.
  useEffect(() => {
    if (open) menuRef.current?.focus();
  }, [open]);

  const toggleMenu = useCallback(() => {
    if (open) {
      setOpen(false);
      setActiveIndex(-1);
    } else {
      openMenu();
    }
  }, [open, openMenu]);

  const handleTriggerKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (open) menuRef.current?.focus();
        else openMenu();
      }
    },
    [open, openMenu]
  );

  const handleMenuKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIndex(items.findIndex((item) => !item.disabled));
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIndex(items.map((item) => !item.disabled).lastIndexOf(true));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const item = items[effectiveIndex];
        if (item && !item.disabled) {
          onSelect?.(item.value);
          setOpen(false);
          if (e.key === ' ') {
            restoreFocusOnKeyUp.current = true;
          } else {
            triggerRef.current?.focus();
          }
        }
      }
    },
    [effectiveIndex, items, moveActive, onSelect]
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
        onClick={toggleMenu}
        onKeyDown={handleTriggerKey}
        className="inline-flex items-center gap-2"
      >
        {trigger}
        <ChevronDown
          className={cn('text-muted-foreground h-4 w-4 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          onKeyDown={handleMenuKey}
          className={cn(
            'border-border bg-card absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-lg border p-1 shadow-xl',
            'focus:outline-none',
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, idx) => {
            const isActive = idx === effectiveIndex;
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
                  item.destructive && 'text-danger hover:bg-danger/10'
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
