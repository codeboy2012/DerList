import type { Metadata } from 'next';

import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { requireAdmin } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { Plus, Search, Users } from 'lucide-react';

import { UserActions } from './UserActions';

export const metadata: Metadata = {
  title: `Users — ${siteConfig.name} Admin`,
};

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; action?: string; sort?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const showCreate = params.action === 'create';
  const sort = params.sort ?? 'newest';

  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: 'insensitive' as const } },
          { username: { contains: query, mode: 'insensitive' as const } },
          { displayName: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const orderByMap: Record<string, Record<string, 'asc' | 'desc'>> = {
    newest: { createdAt: 'desc' },
    oldest: { createdAt: 'asc' },
    username: { username: 'asc' },
    email: { email: 'asc' },
    role: { role: 'asc' },
  };
  const orderBy = orderByMap[sort] ?? orderByMap.newest;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        disabled: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-accent" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Users</h1>
            <p className="text-xs text-muted-foreground">{total} total</p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/users?action=create">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Create User
          </Link>
        </Button>
      </div>

      {/* Create user form (inline) */}
      {showCreate && <CreateUserCard />}

      {/* Search + Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action="/admin/users" method="get" className="flex flex-1 gap-2">
          {sort !== 'newest' && <input type="hidden" name="sort" value={sort} />}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search users by name, email, or username..."
              className="flex h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Search users"
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            Search
          </Button>
        </form>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            <SortLink href={`/admin/users?sort=newest`} label="Newest" active={sort === 'newest'} query={query} />
            <SortLink href={`/admin/users?sort=oldest`} label="Oldest" active={sort === 'oldest'} query={query} />
            <SortLink href={`/admin/users?sort=username`} label="Username" active={sort === 'username'} query={query} />
            <SortLink href={`/admin/users?sort=role`} label="Role" active={sort === 'role'} query={query} />
          </div>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">User</th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Role</th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Joined</th>
                  <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Last Login</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {query ? 'No users match your search.' : 'No users yet.'}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-medium text-accent">
                            {user.displayName.charAt(0).toUpperCase()}
                          </span>
                          <div className="flex flex-col overflow-hidden">
                            <span className="truncate font-medium text-foreground">
                              {user.displayName}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {user.email}
                            </span>
                            <span className="truncate text-xs text-muted-foreground md:hidden">
                              @{user.username}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.disabled ? (
                          <Badge variant="danger">Disabled</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <UserActions user={user} actorRole={actor.role} actorId={actor.id} />
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
                <Link href={`/admin/users?page=${page - 1}${query ? `&q=${query}` : ''}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/users?page=${page + 1}${query ? `&q=${query}` : ''}`}>
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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const variants: Record<string, 'danger' | 'warning' | 'default'> = {
    OWNER: 'danger',
    ADMIN: 'warning',
    USER: 'default',
  };
  return (
    <Badge variant={variants[role] ?? 'default'} className="text-[10px]">
      {role}
    </Badge>
  );
}

function CreateUserCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create User</CardTitle>
      </CardHeader>
      <CardContent>
        <CreateUserForm />
      </CardContent>
    </Card>
  );
}

function SortLink({
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
  const url = query ? `${href}&q=${encodeURIComponent(query)}` : href;
  return (
    <Link
      href={url}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}

async function CreateUserForm() {
  const { CreateUserFormClient } = await import('./CreateUserFormClient');
  return <CreateUserFormClient />;
}
