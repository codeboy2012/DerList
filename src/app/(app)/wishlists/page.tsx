import type { Metadata } from 'next';

import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { requireUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { Archive, List, Package, Plus, Search } from 'lucide-react';

export const metadata: Metadata = {
  title: `Wishlists — ${siteConfig.name}`,
};

interface PageProps {
  searchParams: Promise<{ q?: string; filter?: string }>;
}

export default async function WishlistsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const filter = params.filter ?? 'active';

  const searchWhere = query
    ? {
        OR: [
          { title: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const archiveWhere = filter === 'archived' ? { archived: true } : { archived: false };

  const where = { ownerId: user.id, ...searchWhere, ...archiveWhere };

  const wishlists = await prisma.wishlist.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      description: true,
      icon: true,
      color: true,
      visibility: true,
      archived: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <List className="h-5 w-5 text-accent" aria-hidden />
          <h1 className="text-xl font-semibold text-foreground">Wishlists</h1>
        </div>
        <Button asChild size="sm">
          <Link href="/wishlists/new">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New Wishlist
          </Link>
        </Button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action="/wishlists" method="get" className="flex flex-1 gap-2">
          {filter !== 'active' && <input type="hidden" name="filter" value={filter} />}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search wishlists..."
              className="flex h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Search wishlists"
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            Search
          </Button>
        </form>

        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          <FilterLink href="/wishlists" label="Active" active={filter === 'active'} query={query} />
          <FilterLink href="/wishlists?filter=archived" label="Archived" active={filter === 'archived'} query={query} />
        </div>
      </div>

      {/* Wishlist grid */}
      {wishlists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            {filter === 'archived' ? (
              <>
                <Archive className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No archived wishlists.</p>
              </>
            ) : query ? (
              <>
                <Search className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No wishlists match &ldquo;{query}&rdquo;.</p>
              </>
            ) : (
              <>
                <List className="h-10 w-10 text-muted-foreground/40" />
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-foreground">No wishlists yet</p>
                  <p className="text-xs text-muted-foreground">
                    Create your first wishlist to start tracking things you want.
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href="/wishlists/new">
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Create Wishlist
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wishlists.map((wl) => (
            <Link
              key={wl.id}
              href={`/wishlists/${wl.id}`}
              className="group rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-border/60 hover:shadow-lg hover:shadow-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-lg"
                    style={wl.color ? { backgroundColor: `${wl.color}20`, color: wl.color } : undefined}
                  >
                    {wl.icon || '📋'}
                  </span>
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate font-medium text-foreground group-hover:text-accent transition-colors">
                      {wl.title}
                    </span>
                    {wl.description && (
                      <span className="truncate text-xs text-muted-foreground">
                        {wl.description}
                      </span>
                    )}
                  </div>
                </div>
                <VisibilityBadge visibility={wl.visibility} />
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" aria-hidden />
                  {wl._count.items} items
                </span>
                <span>Updated {formatDate(wl.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function VisibilityBadge({ visibility }: { visibility: string }) {
  const map: Record<string, { variant: 'default' | 'success' | 'warning'; label: string }> = {
    PUBLIC: { variant: 'success', label: 'Public' },
    UNLISTED: { variant: 'warning', label: 'Unlisted' },
    PRIVATE: { variant: 'default', label: 'Private' },
  };
  const { variant, label } = map[visibility] ?? map.PRIVATE;
  return <Badge variant={variant} className="text-[10px]">{label}</Badge>;
}

function FilterLink({
  href,
  label,
  active,
  query,
}: {
  href: string;
  label: string;
  active: boolean;
  query: string;
}) {
  const url = query ? `${href}${href.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}` : href;
  return (
    <Link
      href={url}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}
