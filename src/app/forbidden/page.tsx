import type { Metadata } from 'next';

import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: `Forbidden — ${siteConfig.name}`,
};

/**
 * /forbidden — Shown when an authenticated user lacks the required role.
 */
export default function ForbiddenPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="text-6xl font-bold text-muted-foreground/30">403</span>
        <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          You don&apos;t have permission to access this page. If you believe this is an error, contact an administrator.
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
