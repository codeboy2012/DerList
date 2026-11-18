import type { Metadata } from 'next';
import { Key, Link2, Monitor } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { isGitHubEnabled, isGoogleEnabled } from '@/lib/auth/oauth';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';
import { Badge } from '@/components/ui/Badge';
import { GithubIcon } from '@/components/ui/brand-icons';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { disconnectOAuthAction } from '../actions';
import { ChangePasswordForm } from './ChangePasswordForm';
import { DataPrivacyCard } from './DataPrivacyCard';

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
      select: {
        id: true,
        provider: true,
        providerEmail: true,
        providerName: true,
        createdAt: true,
      },
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
        <div className="border-success/30 bg-success/5 text-success rounded-lg border px-4 py-3 text-sm">
          Account linked successfully.
        </div>
      )}
      {params.error === 'oauth_already_linked_other' && (
        <div className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-4 py-3 text-sm">
          This account is already linked to another user.
        </div>
      )}

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="text-accent h-4 w-4" aria-hidden />
            Connected Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {oauthAccounts.map((account) => (
              <div
                key={account.id}
                className="border-border bg-surface flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <ProviderIcon provider={account.provider} />
                  <div className="flex flex-col">
                    <span className="text-foreground text-sm font-medium capitalize">
                      {account.provider}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {account.providerName ?? account.providerEmail ?? 'Connected'}
                    </span>
                  </div>
                </div>
                <form action={disconnectOAuthAction}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-danger text-xs"
                  >
                    Disconnect
                  </Button>
                </form>
              </div>
            ))}

            {/* Link buttons for unlinked providers */}
            {githubEnabled && !oauthAccounts.some((a) => a.provider === 'github') && (
              <a
                href="/auth/github"
                className="border-border text-muted-foreground hover:border-border/80 hover:text-foreground flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors"
              >
                <GithubIcon className="h-4 w-4" /> Link GitHub
              </a>
            )}
            {googleEnabled && !oauthAccounts.some((a) => a.provider === 'google') && (
              <a
                href="/auth/google"
                className="border-border text-muted-foreground hover:border-border/80 hover:text-foreground flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors"
              >
                <Link2 className="h-4 w-4" /> Link Google
              </a>
            )}

            {oauthAccounts.length === 0 && !githubEnabled && !googleEnabled && (
              <p className="text-muted-foreground text-sm">No OAuth providers configured.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="text-accent h-4 w-4" aria-hidden />
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
            <Monitor className="text-accent h-4 w-4" aria-hidden />
            Active Sessions ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active sessions.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map((session, i) => (
                <div
                  key={session.id}
                  className="border-border bg-surface flex items-center justify-between rounded-lg border px-4 py-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-foreground text-xs font-medium">
                      {i === 0 ? 'Current session' : `Session ${i + 1}`}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {session.ipAddress ?? 'Unknown IP'} · {formatDate(session.createdAt)}
                    </span>
                  </div>
                  {i === 0 && (
                    <Badge variant="success" className="text-[9px]">
                      Active
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DataPrivacyCard />
    </div>
  );
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'github') return <GithubIcon className="text-foreground h-5 w-5" />;
  return <Link2 className="text-foreground h-5 w-5" />;
}
