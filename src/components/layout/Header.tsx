'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/utils/cn';
import { Menu, X } from 'lucide-react';

const navItems = [
  { label: 'Features', href: '/features' },
  { label: 'Roadmap', href: '/roadmap' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Security', href: '/security' },
  { label: 'Open Source', href: '/open-source' },
  { label: 'About', href: '/about' },
] as const;

/**
 * Header — floating glass navbar for the public marketing site.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'glass border-b border-glass-border shadow-lg shadow-black/10'
          : 'bg-transparent',
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="DerList home"
        >
          <Logo size="sm" />
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex glow-sm">
            <Link href="/#beta-access">Beta Access</Link>
          </Button>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </Container>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="absolute inset-x-0 top-full z-50 border-b border-border bg-background/95 backdrop-blur-xl lg:hidden animate-fade-down">
          <Container className="flex flex-col gap-1 py-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Contact
            </Link>
            <Link
              href="/status"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Status
            </Link>
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/login" onClick={() => setMobileOpen(false)}>Sign In</Link>
              </Button>
              <Button asChild size="sm" className="glow-sm">
                <Link href="/#beta-access" onClick={() => setMobileOpen(false)}>Request Beta Access</Link>
              </Button>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
