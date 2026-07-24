import type { Metadata } from 'next';

import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { Plus, Search, ShieldCheck } from 'lucide-react';

import { CreateInvitationForm } from './CreateInvitationForm';
import { InvitationActions } from './InvitationActions';

export const metadata: Metadata = {
  title: `Invitations — ${siteConfig.name} Admin`,
};

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; action?: string }>;
}

export default async function AdminInvitationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const showCreate = params.action === 'create';

  const where = query
    ? { email: { contains: query, mode: 'insensitive' as const } }
    : {};

  const [invitations, total] = await Promise.all([
    prisma.invitation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        token: true,
        createdAt: true,
        expiresAt: true,
        acceptedAt: true,
        invitedBy: { select: { displayName: true } },
      },
    }),
    prisma.invitation.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const baseUrl = siteConfig.url;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-accent" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Invitations</h1>
            <p className="text-xs text-muted-foreground">{total} total</p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/invitations?action=create">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Create Invitation
          </Link>
        </Button>
      </div>

      {/* Create invitation form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateInvitationForm />
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <form action="/admin/invitations" method="get" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search by email..."
            className="flex h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Search invitations"
          />
        </div>
        <Button type="submit" variant="secondary" size="md">
          Search
        </Button>
      </form>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Recipient</th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Invited By</th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Created</th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Expires</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invitations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {query ? 'No invitations match your search.' : 'No invitations yet.'}
                    </td>
                  </tr>
                ) : (
                  invitations.map((inv) => {
                    const isAccepted = !!inv.acceptedAt;
                    const isExpired = !isAccepted && inv.expiresAt < new Date();

                    return (
                      <tr key={inv.id} className="hover:bg-surface/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">{inv.email}</span>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {inv.invitedBy.displayName}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(inv.createdAt)}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(inv.expiresAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isAccepted ? (
                            <Badge variant="success">Accepted</Badge>
                          ) : isExpired ? (
                            <Badge variant="danger">Expired</Badge>
                          ) : (
                            <Badge variant="warning">Pending</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <InvitationActions
                            invitation={{
                              id: inv.id,
                              token: inv.token,
                              acceptedAt: inv.acceptedAt,
                              expiresAt: inv.expiresAt,
                            }}
                            baseUrl={baseUrl}
                          />
                        </td>
                      </tr>
                    );
                  })
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
                <Link href={`/admin/invitations?page=${page - 1}${query ? `&q=${query}` : ''}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/invitations?page=${page + 1}${query ? `&q=${query}` : ''}`}>
                  Next
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
