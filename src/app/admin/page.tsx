import type { Metadata } from 'next';

import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { getActionLabel } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { formatDate } from '@/lib/format';
import {
  Clock,
  Key,
  Mail,
  Plus,
  ScrollText,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';

export const metadata: Metadata = {
  title: `Dashboard — ${siteConfig.name} Admin`,
};

/**
 * Fetch all dashboard statistics in parallel for maximum performance.
 */
async function getDashboardStats() {
  const [
    totalUsers,
    activeUsers,
    disabledUsers,
    pendingWaitlist,
    pendingInvitations,
    acceptedInvitations,
    activeSessions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { disabled: false } }),
    prisma.user.count({ where: { disabled: true } }),
    prisma.waitlist.count({ where: { approvedAt: null } }),
    prisma.invitation.count({ where: { acceptedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.invitation.count({ where: { acceptedAt: { not: null } } }),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
  ]);

  return {
    totalUsers,
    activeUsers,
    disabledUsers,
    pendingWaitlist,
    pendingInvitations,
    acceptedInvitations,
    activeSessions,
  };
}

async function getRecentUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
      createdAt: true,
      disabled: true,
    },
  });
}

async function getRecentInvitations() {
  return prisma.invitation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      email: true,
      createdAt: true,
      expiresAt: true,
      acceptedAt: true,
      invitedBy: { select: { displayName: true } },
    },
  });
}

async function getRecentWaitlist() {
  return prisma.waitlist.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      name: true,
      email: true,
      interest: true,
      createdAt: true,
      approvedAt: true,
    },
  });
}

async function getRecentAuditLogs() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      action: true,
      actorName: true,
      targetName: true,
      createdAt: true,
    },
  });
}

export default async function AdminDashboardPage() {
  const [stats, recentUsers, recentInvitations, recentWaitlist, recentLogs] =
    await Promise.all([
      getDashboardStats(),
      getRecentUsers(),
      getRecentInvitations(),
      getRecentWaitlist(),
      getRecentAuditLogs(),
    ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your {siteConfig.name} instance.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Active Users"
          value={stats.activeUsers}
          icon={<UserCheck className="h-4 w-4" />}
          variant="success"
        />
        <StatCard
          label="Disabled Users"
          value={stats.disabledUsers}
          icon={<UserMinus className="h-4 w-4" />}
          variant="danger"
        />
        <StatCard
          label="Active Sessions"
          value={stats.activeSessions}
          icon={<Key className="h-4 w-4" />}
        />
        <StatCard
          label="Pending Waitlist"
          value={stats.pendingWaitlist}
          icon={<Clock className="h-4 w-4" />}
          variant="warning"
        />
        <StatCard
          label="Invitations Pending"
          value={stats.pendingInvitations}
          icon={<Mail className="h-4 w-4" />}
        />
        <StatCard
          label="Invitations Accepted"
          value={stats.acceptedInvitations}
          icon={<ShieldCheck className="h-4 w-4" />}
          variant="success"
        />
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin/invitations?action=create">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Invite User
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin/waitlist?filter=pending">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Review Waitlist
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin/users?action=create">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Create User
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin/audit">
                <ScrollText className="h-3.5 w-3.5" aria-hidden />
                View Audit Logs
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent activity grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent users */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">Recent Users</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/users">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No users yet.</p>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="truncate text-sm font-medium text-foreground">
                        {user.displayName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <RoleBadge role={user.role} />
                      {user.disabled && <Badge variant="danger">Disabled</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent invitations */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">Recent Invitations</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/invitations">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentInvitations.length === 0 ? (
              <p className="text-xs text-muted-foreground">No invitations yet.</p>
            ) : (
              <div className="space-y-3">
                {recentInvitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="truncate text-sm font-medium text-foreground">
                        {inv.email}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        by {inv.invitedBy.displayName}
                      </span>
                    </div>
                    <InvitationStatusBadge
                      acceptedAt={inv.acceptedAt}
                      expiresAt={inv.expiresAt}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent waitlist */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">Recent Waitlist</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/waitlist">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentWaitlist.length === 0 ? (
              <p className="text-xs text-muted-foreground">No waitlist entries yet.</p>
            ) : (
              <div className="space-y-3">
                {recentWaitlist.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="truncate text-sm font-medium text-foreground">
                        {entry.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {entry.email}
                      </span>
                    </div>
                    {entry.approvedAt ? (
                      <Badge variant="success">Approved</Badge>
                    ) : (
                      <Badge variant="warning">Pending</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity log */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">Activity Log</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/audit">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <ScrollText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <span className="truncate text-xs font-medium text-foreground">
                          {getActionLabel(log.action)}
                          {log.targetName && (
                            <span className="text-muted-foreground">
                              {' '}— {log.targetName}
                            </span>
                          )}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {log.actorName ?? 'System'} · {formatDate(log.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (server-rendered, no client JS)
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  variant,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger';
}) {
  const colorMap = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };
  const valueColor = variant ? colorMap[variant] : 'text-foreground';

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-muted-foreground">
          {icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className={`text-2xl font-semibold tabular-nums ${valueColor}`}>
            {value}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function RoleBadge({ role }: { role: string }) {
  const variants: Record<string, 'default' | 'warning' | 'danger'> = {
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

function InvitationStatusBadge({
  acceptedAt,
  expiresAt,
}: {
  acceptedAt: Date | null;
  expiresAt: Date;
}) {
  if (acceptedAt) return <Badge variant="success">Accepted</Badge>;
  if (expiresAt < new Date()) return <Badge variant="danger">Expired</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}
