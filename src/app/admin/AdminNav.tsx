'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LogOut,
  Mail,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { logoutAction } from '../(auth)/actions';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/providers', label: 'API Providers', icon: Settings },
  { href: '/admin/waitlist', label: 'Waitlist', icon: Mail },
  { href: '/admin/invitations', label: 'Invitations', icon: ShieldCheck },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
] as const;

/**
 * AdminNav — sidebar navigation for admin pages.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin navigation"
      className="border-border bg-card/50 flex shrink-0 flex-col border-b p-4 md:w-56 md:border-r md:border-b-0"
    >
      <ul className="flex gap-1 md:flex-col">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="h-4 w-4" aria-hidden />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Logout */}
      <form action={logoutAction} className="mt-auto hidden pt-4 md:block">
        <button
          type="submit"
          className="text-muted-foreground hover:bg-surface hover:text-foreground focus-visible:ring-ring flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign Out
        </button>
      </form>
    </nav>
  );
}
