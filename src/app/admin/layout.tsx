import type { ReactNode } from 'react';

import { Container } from '@/components/ui/Container';
import { requireAdmin } from '@/lib/auth';
import { siteConfig } from '@/lib/site-config';

import { AdminNav } from './AdminNav';

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Admin layout — wraps all /admin/* pages.
 *
 * Performs full server-side authorization check (requireAdmin).
 * The proxy only checks cookie presence; this layout confirms
 * the session is valid and the user has ADMIN or OWNER role.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-svh flex-col">
      {/* Admin header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <Container className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">
              {siteConfig.name}
            </span>
            <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {user.displayName}
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {user.role}
            </span>
          </div>
        </Container>
      </header>

      {/* Navigation + content */}
      <div className="flex flex-1 flex-col md:flex-row">
        <AdminNav />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
