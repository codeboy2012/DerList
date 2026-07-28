'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Key, Settings, User } from 'lucide-react';
import { cn } from '@/utils/cn';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
};

const items: NavItem[] = [
  { href: '/settings/profile', label: 'Profile', icon: User },
  { href: '/settings/account', label: 'Account', icon: Key },
  { href: '/settings/integrations', label: 'Integrations', icon: Settings },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings" className="flex gap-1 lg:w-48 lg:flex-col">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.children && item.children.some((child) => pathname === child.href));
        const expanded = active && item.children;

        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                active
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:bg-surface hover:text-foreground'
              )}
              aria-current={active && !item.children ? 'page' : undefined}
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>

            {expanded && item.children && (
              <div className="mt-1 ml-6 space-y-1">
                {item.children.map((child) => {
                  const childActive = pathname === child.href;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                        childActive
                          ? 'bg-accent/20 text-accent font-medium'
                          : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                      )}
                      aria-current={childActive ? 'page' : undefined}
                    >
                      <child.icon className="h-3.5 w-3.5" aria-hidden />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
