import type { Metadata } from 'next';
import Link from 'next/link';
import { Archive, List, Package, Plus, Search } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

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
          <List className="text-accent h-5 w-5" aria-hidden />
          <h1 className="text-foreground text-xl font-semibold">Wishlists</h1>
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
            <Search
              className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search wishlists..."
              className="border-border bg-surface text-foreground placeholder:text-muted focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 w-full rounded-lg border py-2 pr-3 pl-9 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-label="Search wishlists"
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            Search
          </Button>
        </form>

        <div className="border-border bg-surface flex gap-1 rounded-lg border p-1">
          <FilterLink href="/wishlists" label="Active" active={filter === 'active'} query={query} />
          <FilterLink
            href="/wishlists?filter=archived"
            label="Archived"
            active={filter === 'archived'}
            query={query}
          />
        </div>
      </div>

      {/* Wishlist grid */}
      {wishlists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            {filter === 'archived' ? (
              <>
                <Archive className="text-muted-foreground/40 h-10 w-10" />
                <p className="text-muted-foreground text-sm">No archived wishlists.</p>
              </>
            ) : query ? (
              <>
                <Search className="text-muted-foreground/40 h-10 w-10" />
                <p className="text-muted-foreground text-sm">
                  No wishlists match &ldquo;{query}&rdquo;.
                </p>
              </>
            ) : (
              <>
                <List className="text-muted-foreground/40 h-10 w-10" />
                <div className="flex flex-col gap-2">
                  <p className="text-foreground text-sm font-medium">No wishlists yet</p>
                  <p className="text-muted-foreground text-xs">
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
              className="group border-border bg-card hover:border-border/60 focus-visible:ring-ring rounded-xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 focus-visible:ring-2 focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="bg-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                    style={
                      wl.color ? { backgroundColor: `${wl.color}20`, color: wl.color } : undefined
                    }
                  >
                    {wl.icon || '📋'}
                  </span>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-foreground group-hover:text-accent truncate font-medium transition-colors">
                      {wl.title}
                    </span>
                    {wl.description && (
                      <span className="text-muted-foreground truncate text-xs">
                        {wl.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-muted-foreground mt-4 flex items-center gap-4 text-xs">
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
  const url = query
    ? `${href}${href.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}`
    : href;
  return (
    <Link
      href={url}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}
