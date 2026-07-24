import type { Metadata } from 'next';

import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { getActionLabel } from '@/lib/audit';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { ScrollText, Search } from 'lucide-react';

export const metadata: Metadata = {
  title: `Audit Log — ${siteConfig.name} Admin`,
};

const PAGE_SIZE = 30;

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; action?: string }>;
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const actionFilter = params.action?.trim() ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));

  const where: Record<string, unknown> = {};

  if (query) {
    where.OR = [
      { actorName: { contains: query, mode: 'insensitive' } },
      { targetName: { contains: query, mode: 'insensitive' } },
      { action: { contains: query, mode: 'insensitive' } },
    ];
  }

  if (actionFilter) {
    where.action = { startsWith: actionFilter };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ScrollText className="h-5 w-5 text-accent" aria-hidden />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
          <p className="text-xs text-muted-foreground">{total} entries</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action="/admin/audit" method="get" className="flex flex-1 gap-2">
          {actionFilter && <input type="hidden" name="action" value={actionFilter} />}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search by actor, target, or action..."
              className="flex h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Search audit logs"
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            Search
          </Button>
        </form>

        {/* Action type filter */}
        <div className="flex flex-wrap gap-1">
          <FilterChip href="/admin/audit" label="All" active={!actionFilter} query={query} />
          <FilterChip href="/admin/audit?action=user" label="User" active={actionFilter === 'user'} query={query} />
          <FilterChip href="/admin/audit?action=invitation" label="Invitation" active={actionFilter === 'invitation'} query={query} />
          <FilterChip href="/admin/audit?action=waitlist" label="Waitlist" active={actionFilter === 'waitlist'} query={query} />
        </div>
      </div>

      {/* Log entries */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Action</th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Actor</th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Target</th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">IP</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {query || actionFilter ? 'No logs match your filters.' : 'No audit log entries yet.'}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">
                            {getActionLabel(log.action)}
                          </span>
                          <ActionBadge action={log.action} />
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className="text-foreground">
                          {log.actorName ?? <span className="text-muted-foreground">System</span>}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="flex flex-col gap-0.5">
                          {log.targetName && (
                            <span className="text-foreground">{log.targetName}</span>
                          )}
                          {log.targetType && (
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {log.targetType}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.ipAddress ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(log.createdAt)}
                        </span>
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
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild size="sm" variant="outline">
                <Link href={buildPageUrl(page - 1, query, actionFilter)}>Previous</Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild size="sm" variant="outline">
                <Link href={buildPageUrl(page + 1, query, actionFilter)}>Next</Link>
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

function ActionBadge({ action }: { action: string }) {
  const category = action.split('.')[0];
  const variants: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
    user: 'default',
    invitation: 'warning',
    waitlist: 'success',
  };
  return (
    <Badge variant={variants[category] ?? 'default'} className="w-fit text-[9px]">
      {action}
    </Badge>
  );
}

function FilterChip({
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
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-accent/30 bg-accent/10 text-accent'
          : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}

function buildPageUrl(page: number, query: string, actionFilter: string): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (query) params.set('q', query);
  if (actionFilter) params.set('action', actionFilter);
  return `/admin/audit?${params.toString()}`;
}
