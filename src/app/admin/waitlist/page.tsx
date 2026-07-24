import type { Metadata } from 'next';

import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { Download, Mail, Search } from 'lucide-react';

import { WaitlistTable } from './WaitlistTable';

export const metadata: Metadata = {
  title: `Waitlist — ${siteConfig.name} Admin`,
};

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}

export default async function AdminWaitlistPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const filter = params.filter ?? 'all';

  // Build where clause
  const searchFilter = query
    ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
          { interest: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const statusFilter =
    filter === 'pending'
      ? { approvedAt: null }
      : filter === 'approved'
        ? { approvedAt: { not: null } }
        : {};

  const where = { ...searchFilter, ...statusFilter };

  const [entries, total] = await Promise.all([
    prisma.waitlist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        interest: true,
        newsletter: true,
        createdAt: true,
        approvedAt: true,
      },
    }),
    prisma.waitlist.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-accent" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Waitlist</h1>
            <p className="text-xs text-muted-foreground">{total} entries</p>
          </div>
        </div>
        <Button asChild size="sm" variant="secondary">
          <a href="/admin/waitlist/export" download>
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export CSV
          </a>
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action="/admin/waitlist" method="get" className="flex flex-1 gap-2">
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search by name, email, or interest..."
              className="flex h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Search waitlist"
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            Search
          </Button>
        </form>

        {/* Filter tabs */}
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          <FilterLink href="/admin/waitlist" label="All" active={filter === 'all'} query={query} />
          <FilterLink href="/admin/waitlist?filter=pending" label="Pending" active={filter === 'pending'} query={query} />
          <FilterLink href="/admin/waitlist?filter=approved" label="Approved" active={filter === 'approved'} query={query} />
        </div>
      </div>

      {/* Table (client component for checkbox selection) */}
      <WaitlistTable entries={entries} query={query} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild size="sm" variant="outline">
                <Link href={buildPageUrl(page - 1, query, filter)}>Previous</Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild size="sm" variant="outline">
                <Link href={buildPageUrl(page + 1, query, filter)}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper components
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

function buildPageUrl(page: number, query: string, filter: string): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (query) params.set('q', query);
  if (filter && filter !== 'all') params.set('filter', filter);
  return `/admin/waitlist?${params.toString()}`;
}
