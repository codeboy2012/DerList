'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Logo } from '@/components/ui/Logo';
import { logoutAction } from '../(auth)/actions';

const mainNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/wishlists', label: 'Wishlists', icon: List },
  { href: '/assistant', label: 'Shopping Assistant', icon: MessageCircle },
  { href: '/settings/profile', label: 'Settings', icon: Settings },
] as const;

interface AppNavProps {
  user: { role: string; displayName: string };
}

/**
 * AppNav — Responsive navigation.
 * Desktop: Fixed sidebar (md+).
 * Mobile: Hamburger menu that opens a slide-out drawer.
 */
export function AppNav({ user }: AppNavProps) {
  const pathname = usePathname();
  const isAdmin = user.role === 'ADMIN' || user.role === 'OWNER';
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileOpen]);

  const navItems = (
    <>
      {mainNav.map((item) => {
        const active =
          item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              'md:gap-2.5 md:rounded-lg md:px-3 md:py-2 md:text-[13px]',
              active
                ? 'bg-accent/10 text-accent shadow-sm'
                : 'text-muted-foreground hover:bg-card-hover hover:text-foreground'
            )}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon className="h-5 w-5 md:h-4 md:w-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}

      {isAdmin && (
        <>
          <div className="bg-border my-2 h-px" />
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150',
              'md:gap-2.5 md:rounded-lg md:px-3 md:py-2 md:text-[13px]',
              'text-muted-foreground hover:bg-card-hover hover:text-foreground',
              pathname.startsWith('/admin') && 'bg-accent/10 text-accent shadow-sm'
            )}
          >
            <ShieldCheck className="h-5 w-5 md:h-4 md:w-4" aria-hidden />
            Admin
          </Link>
        </>
      )}
    </>
  );

  return (
    <>
      {/* ─── Desktop Sidebar ─── */}
      <aside className="border-border bg-surface/50 hidden w-56 shrink-0 flex-col border-r md:flex">
        <div className="border-border flex h-14 items-center border-b px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Logo size="sm" />
          </Link>
        </div>
        <nav aria-label="App navigation" className="flex flex-1 flex-col gap-1 p-3">
          {navItems}
        </nav>
        <div className="border-border border-t p-3">
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-muted-foreground hover:bg-card-hover hover:text-foreground flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* ─── Mobile Hamburger Button (rendered in the header via portal-style) ─── */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="text-foreground hover:bg-surface fixed top-3.5 left-4 z-30 flex h-8 w-8 items-center justify-center rounded-lg transition-colors md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ─── Mobile Drawer ─── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />

          {/* Drawer panel */}
          <div className="bg-card animate-in slide-in-from-left relative flex h-full w-72 max-w-[85vw] flex-col shadow-2xl duration-200">
            {/* Header */}
            <div className="border-border flex h-14 items-center justify-between border-b px-5">
              <Link href="/dashboard" className="flex items-center gap-2.5">
                <Logo size="sm" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-lg"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav */}
            <nav
              aria-label="Mobile navigation"
              className="flex flex-1 flex-col gap-1 overflow-y-auto p-4"
            >
              {navItems}
            </nav>

            {/* User & Sign Out */}
            <div className="border-border border-t p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="bg-accent/10 text-accent flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="text-foreground text-sm font-medium">{user.displayName}</span>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="text-muted-foreground hover:bg-surface hover:text-foreground flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors"
                >
                  <LogOut className="h-5 w-5" aria-hidden />
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
