'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/utils/cn';
import { Logo } from '@/components/ui/Logo';
import { siteConfig } from '@/lib/site-config';
import {
  LayoutDashboard,
  List,
  LogOut,
  Settings,
  ShieldCheck,
} from 'lucide-react';

import { logoutAction } from '../(auth)/actions';

const mainNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/wishlists', label: 'Wishlists', icon: List },
  { href: '/settings/profile', label: 'Settings', icon: Settings },
] as const;

interface AppNavProps {
  user: { role: string; displayName: string };
}

/**
 * AppNav — premium sidebar navigation inspired by Linear/Vercel.
 * Hidden on mobile (app uses top bar there), visible on md+.
 */
export function AppNav({ user }: AppNavProps) {
  const pathname = usePathname();
  const isAdmin = user.role === 'ADMIN' || user.role === 'OWNER';

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface/50 md:flex">
      {/* Brand */}
      <div className="flex h-14 items-center border-b border-border px-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo size="sm" />
        </Link>
      </div>

      {/* Nav */}
      <nav aria-label="App navigation" className="flex flex-1 flex-col gap-1 p-3">
        {mainNav.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-accent/10 text-accent shadow-sm'
                  : 'text-muted-foreground hover:bg-card-hover hover:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="my-2 h-px bg-border" />
            <Link
              href="/admin"
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                'text-muted-foreground hover:bg-card-hover hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                pathname.startsWith('/admin') && 'bg-accent/10 text-accent shadow-sm',
              )}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Admin
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
