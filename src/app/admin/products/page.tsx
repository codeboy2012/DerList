import type { Metadata } from 'next';

import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatDate } from '@/lib/format';
import { getQueueStats } from '@/lib/jobs';
import { getSchedulerStatus } from '@/lib/jobs/scheduler';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  Search,
} from 'lucide-react';

import { ProductRowActions } from './ProductRowActions';
import { retryFailedJobsAction } from './actions';

export const metadata: Metadata = {
  title: `Products — ${siteConfig.name} Admin`,
};

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const filter = params.filter ?? 'all';

  const oneDayAgo = new Date(new Date().getTime() - 86_400_000);

  // Stats
  const [queueStats, schedulerStats, totalProducts, importedToday] = await Promise.all([
    getQueueStats(),
    getSchedulerStatus(),
    prisma.product.count(),
    prisma.product.count({
      where: { createdAt: { gte: oneDayAgo } },
    }),
  ]);

  // Build where clause
  const searchWhere = query
    ? {
        OR: [
          { title: { contains: query, mode: 'insensitive' as const } },
          { domain: { contains: query, mode: 'insensitive' as const } },
          { brand: { contains: query, mode: 'insensitive' as const } },
          { retailer: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const filterWhere =
    filter === 'imported' ? { source: 'IMPORTED' as const } :
    filter === 'manual' ? { source: 'MANUAL' as const } :
    filter === 'stale' ? { source: 'IMPORTED' as const, lastFetchedAt: { lt: oneDayAgo } } :
    {};

  const where = { ...searchWhere, ...filterWhere };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        domain: true,
        retailer: true,
        brand: true,
        currentPrice: true,
        currency: true,
        inStock: true,
        source: true,
        canonicalUrl: true,
        lastFetchedAt: true,
        createdAt: true,
        image: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Package className="h-5 w-5 text-accent" aria-hidden />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Products</h1>
          <p className="text-xs text-muted-foreground">{totalProducts} total</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Products" value={totalProducts} icon={<Package className="h-4 w-4" />} />
        <StatCard label="Imported Today" value={importedToday} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Needing Refresh" value={schedulerStats.needsRefresh} icon={<RefreshCw className="h-4 w-4" />} variant="warning" />
        <StatCard label="Failed Jobs" value={queueStats.failed} icon={<AlertTriangle className="h-4 w-4" />} variant="danger" />
      </div>

      {/* Queue status */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium">Job Queue</CardTitle>
          {queueStats.failed > 0 && (
            <form action={retryFailedJobsAction}>
              <Button type="submit" size="sm" variant="secondary">
                Retry Failed
              </Button>
            </form>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Pending: <strong className="text-foreground">{queueStats.pending}</strong>
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> Running: <strong className="text-foreground">{queueStats.running}</strong>
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Today: <strong className="text-foreground">{queueStats.successToday}</strong>
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-danger" /> Failed: <strong className="text-foreground">{queueStats.failed}</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action="/admin/products" method="get" className="flex flex-1 gap-2">
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search by title, brand, retailer, domain..."
              className="flex h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Search products"
            />
          </div>
          <Button type="submit" variant="secondary" size="md">Search</Button>
        </form>

        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          <FilterLink href="/admin/products" label="All" active={filter === 'all'} query={query} />
          <FilterLink href="/admin/products?filter=imported" label="Imported" active={filter === 'imported'} query={query} />
          <FilterLink href="/admin/products?filter=manual" label="Manual" active={filter === 'manual'} query={query} />
          <FilterLink href="/admin/products?filter=stale" label="Stale" active={filter === 'stale'} query={query} />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Product</th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Price</th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Source</th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Last Fetched</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {query ? 'No products match your search.' : 'No products yet.'}
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product.image ? (
                            <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-surface">
                              <img src={product.image} alt="" className="h-full w-full object-cover" />
                            </span>
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-muted-foreground">
                              <Package className="h-4 w-4" />
                            </span>
                          )}
                          <div className="flex flex-col overflow-hidden">
                            <span className="truncate font-medium text-foreground">{product.title}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {product.retailer ?? product.domain ?? '—'}
                              {product.brand && ` · ${product.brand}`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {product.currentPrice != null ? (
                          <span className="font-medium text-foreground">
                            {product.currency} {Number(product.currentPrice).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <Badge variant={product.source === 'IMPORTED' ? 'default' : 'secondary'} className="text-[10px]">
                          {product.source}
                        </Badge>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {product.lastFetchedAt ? formatDate(product.lastFetchedAt) : 'Never'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ProductRowActions productId={product.id} hasUrl={!!product.canonicalUrl} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild size="sm" variant="outline">
                <Link href={buildUrl(page - 1, query, filter)}>Previous</Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild size="sm" variant="outline">
                <Link href={buildUrl(page + 1, query, filter)}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, variant }: { label: string; value: number; icon: React.ReactNode; variant?: 'warning' | 'danger' }) {
  const color = variant === 'danger' ? 'text-danger' : variant === 'warning' ? 'text-warning' : 'text-foreground';
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-muted-foreground">{icon}</span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
          <span className={`text-xl font-semibold tabular-nums ${color}`}>{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterLink({ href, label, active, query }: { href: string; label: string; active: boolean; query: string }) {
  const url = query ? `${href}${href.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}` : href;
  return (
    <Link href={url} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
      {label}
    </Link>
  );
}

function buildUrl(page: number, query: string, filter: string): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (query) params.set('q', query);
  if (filter && filter !== 'all') params.set('filter', filter);
  return `/admin/products?${params.toString()}`;
}
