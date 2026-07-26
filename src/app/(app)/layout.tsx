import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { siteConfig } from '@/lib/site-config';
import { Container } from '@/components/ui/Container';
import { Logo } from '@/components/ui/Logo';
import { AppNav } from './AppNav';

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * App layout — wraps all authenticated user pages.
 * Premium sidebar + header design inspired by Linear/Vercel.
 */
export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await requireUser();

  return (
    <div className="flex min-h-svh">
      {/* Sidebar */}
      <AppNav user={user} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="border-border bg-background/80 sticky top-0 z-20 flex h-14 items-center justify-between border-b px-6 backdrop-blur-md">
          <div className="flex items-center gap-2 md:hidden">
            {/* Space for hamburger button (positioned fixed in AppNav) */}
            <div className="w-8" />
            <Link href="/dashboard">
              <Logo size="sm" />
            </Link>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <span className="bg-accent/10 text-accent flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium">
              {user.displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
