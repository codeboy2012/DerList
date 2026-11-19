'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Logo } from '@/components/ui/Logo';

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
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled ? 'glass border-glass-border border-b shadow-lg shadow-black/10' : 'bg-transparent'
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none"
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
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <span className="border-accent/30 bg-accent/5 text-accent hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-wide uppercase sm:inline-flex">
            <span aria-hidden className="bg-accent h-1.5 w-1.5 rounded-full" />
            Open Beta
          </span>
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild size="sm" className="glow-sm hidden sm:inline-flex">
            <Link href="/register">Create Account</Link>
          </Button>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </Container>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-border bg-background/95 animate-fade-down absolute inset-x-0 top-full z-50 border-b backdrop-blur-xl lg:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="text-foreground hover:bg-surface rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="text-foreground hover:bg-surface rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            >
              Contact
            </Link>
            <Link
              href="/status"
              onClick={() => setMobileOpen(false)}
              className="text-foreground hover:bg-surface rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            >
              Status
            </Link>
            <div className="border-border mt-3 flex flex-col gap-2 border-t pt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  Sign In
                </Link>
              </Button>
              <Button asChild size="sm" className="glow-sm">
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  Create Account
                </Link>
              </Button>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
