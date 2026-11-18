'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  Heart,
  LayoutDashboard,
  List,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { cn } from '@/utils/cn';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  href?: string;
  action?: () => void;
  section: string;
}

interface SearchResult {
  id: string;
  label: string;
  description?: string;
  href: string;
  type: 'wishlist' | 'product' | 'user';
}

// ─────────────────────────────────────────────────────────────────────────────
// Static commands
// ─────────────────────────────────────────────────────────────────────────────

const staticCommands: CommandItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
    href: '/dashboard',
    section: 'Navigation',
  },
  {
    id: 'wishlists',
    label: 'Wishlists',
    icon: <List className="h-4 w-4" />,
    href: '/wishlists',
    section: 'Navigation',
  },
  {
    id: 'new-wishlist',
    label: 'New Wishlist',
    icon: <Heart className="h-4 w-4" />,
    href: '/wishlists/new',
    section: 'Actions',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="h-4 w-4" />,
    href: '/settings/profile',
    section: 'Navigation',
  },
  {
    id: 'appearance',
    label: 'Appearance & Local Settings',
    icon: <Settings className="h-4 w-4" />,
    href: '/settings/appearance',
    section: 'Navigation',
  },
  {
    id: 'admin',
    label: 'Admin Panel',
    icon: <ShieldCheck className="h-4 w-4" />,
    href: '/admin',
    section: 'Navigation',
  },
  {
    id: 'admin-users',
    label: 'Manage Users',
    icon: <Users className="h-4 w-4" />,
    href: '/admin/users',
    section: 'Admin',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(open);
  const router = useRouter();

  // Reset state when toggling
  const handleToggle = useCallback(() => {
    setOpen((o) => {
      if (!o) {
        setQuery('');
        setActiveIndex(0);
        setResults([]);
      }
      return !o;
    });
  }, []);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleToggle();
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleToggle]);

  // Focus input when opened
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    prevOpenRef.current = open;
  }, [open]);

  // Search when query changes
  useEffect(() => {
    if (!query.trim()) {
      // No query — empty results (will show static commands instead)
      return;
    }

    const abortController = new AbortController();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: abortController.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } catch {
        // Aborted or network error — ignore
      }
    });

    return () => abortController.abort();
  }, [query]);

  // Filter static commands by query
  const filteredCommands = query
    ? staticCommands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.section.toLowerCase().includes(query.toLowerCase())
      )
    : staticCommands;

  // Combined items
  const allItems: {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    href: string;
    section: string;
  }[] = [
    ...filteredCommands.map((cmd) => ({
      id: cmd.id,
      label: cmd.label,
      description: cmd.description,
      icon: cmd.icon,
      href: cmd.href ?? '',
      section: cmd.section,
    })),
    ...results.map((r) => ({
      id: r.id,
      label: r.label,
      description: r.description,
      icon:
        r.type === 'wishlist' ? (
          <List className="h-4 w-4" />
        ) : r.type === 'product' ? (
          <Package className="h-4 w-4" />
        ) : (
          <Users className="h-4 w-4" />
        ),
      href: r.href,
      section: 'Search Results',
    })),
  ];

  const navigate = useCallback(
    (href: string) => {
      if (href) {
        router.push(href);
        setOpen(false);
      }
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = allItems[activeIndex];
      if (item) navigate(item.href);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Dialog */}
      <div className="fixed inset-x-4 top-[15vh] z-50 mx-auto max-w-lg sm:inset-x-auto">
        <div
          role="dialog"
          aria-label="Command palette"
          className="border-border bg-card overflow-hidden rounded-xl border shadow-2xl"
        >
          {/* Input */}
          <div className="border-border flex items-center gap-3 border-b px-4 py-3">
            <Search className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search or type a command..."
              className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
              aria-label="Search"
            />
            <kbd className="border-border bg-surface text-muted-foreground hidden rounded border px-1.5 py-0.5 text-[10px] sm:inline">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {allItems.length === 0 ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                {query ? 'No results found.' : 'Start typing to search...'}
              </p>
            ) : (
              <ul role="listbox" aria-label="Commands">
                {allItems.map((item, i) => (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={i === activeIndex}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      i === activeIndex
                        ? 'bg-accent/10 text-accent'
                        : 'text-foreground hover:bg-surface'
                    )}
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span className="text-muted-foreground shrink-0">{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.description && (
                      <span className="text-muted-foreground truncate text-xs">
                        {item.description}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-border flex items-center justify-between border-t px-4 py-2">
            <span className="text-muted-foreground text-[10px]">
              ↑↓ Navigate · ↵ Select · ESC Close
            </span>
            <span className="text-muted-foreground text-[10px]">⌘K to toggle</span>
          </div>
        </div>
      </div>
    </>
  );
}
