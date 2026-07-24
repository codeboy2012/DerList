import type { Metadata } from 'next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { GithubIcon } from '@/components/ui/brand-icons';
import { requireUser } from '@/lib/auth';
import { isGitHubEnabled, isGoogleEnabled } from '@/lib/auth/oauth';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { Key, Link2, Monitor, Trash2 } from 'lucide-react';

import { ChangePasswordForm } from './ChangePasswordForm';
import { disconnectOAuthAction } from '../actions';

export const metadata: Metadata = {
  title: `Account — ${siteConfig.name}`,
};

interface AccountPageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function AccountSettingsPage({ searchParams }: AccountPageProps) {
  const sessionUser = await requireUser();
  const params = await searchParams;

  const [oauthAccounts, sessions] = await Promise.all([
    prisma.oAuthAccount.findMany({
      where: { userId: sessionUser.id },
      select: { id: true, provider: true, providerEmail: true, providerName: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.session.findMany({
      where: { userId: sessionUser.id, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, ipAddress: true, userAgent: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const githubEnabled = isGitHubEnabled();
  const googleEnabled = isGoogleEnabled();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* Success/Error messages from OAuth linking */}
      {params.success === 'provider_linked' && (
        <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          Account linked successfully.
        </div>
      )}
      {params.error === 'oauth_already_linked_other' && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          This account is already linked to another user.
        </div>
      )}

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-accent" aria-hidden />
            Connected Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {oauthAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                <div className="flex items-center gap-3">
                  <ProviderIcon provider={account.provider} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium capitalize text-foreground">{account.provider}</span>
                    <span className="text-xs text-muted-foreground">
                      {account.providerName ?? account.providerEmail ?? 'Connected'}
                    </span>
                  </div>
                </div>
                <form action={disconnectOAuthAction}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-danger">
                    Disconnect
                  </Button>
                </form>
              </div>
            ))}

            {/* Link buttons for unlinked providers */}
            {githubEnabled && !oauthAccounts.some((a) => a.provider === 'github') && (
              <a
                href="/auth/github"
                className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-border/80 hover:text-foreground"
              >
                <GithubIcon className="h-4 w-4" /> Link GitHub
              </a>
            )}
            {googleEnabled && !oauthAccounts.some((a) => a.provider === 'google') && (
              <a
                href="/auth/google"
                className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-border/80 hover:text-foreground"
              >
                <Link2 className="h-4 w-4" /> Link Google
              </a>
            )}

            {oauthAccounts.length === 0 && !githubEnabled && !googleEnabled && (
              <p className="text-sm text-muted-foreground">No OAuth providers configured.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4 text-accent" aria-hidden />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4 text-accent" aria-hidden />
            Active Sessions ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map((session, i) => (
                <div key={session.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-foreground">
                      {i === 0 ? 'Current session' : `Session ${i + 1}`}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {session.ipAddress ?? 'Unknown IP'} · {formatDate(session.createdAt)}
                    </span>
                  </div>
                  {i === 0 && <Badge variant="success" className="text-[9px]">Active</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'github') return <GithubIcon className="h-5 w-5 text-foreground" />;
  return <Link2 className="h-5 w-5 text-foreground" />;
}
