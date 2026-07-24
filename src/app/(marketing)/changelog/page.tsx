import type { Metadata } from 'next';

import { Badge } from '@/components/ui/Badge';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: `Changelog — ${siteConfig.name}`,
  description: 'See what\u2019s new in DerList — releases, improvements, and fixes.',
};

const releases = [
  {
    version: '0.1.0-beta',
    date: 'July 2026',
    badge: 'Current',
    badgeVariant: 'default' as const,
    changes: [
      { type: 'feature', text: 'Premium UI redesign with glass effects and animations' },
      { type: 'feature', text: 'GitHub & Google OAuth authentication' },
      { type: 'feature', text: 'Command palette (Ctrl+K) with global search' },
      { type: 'feature', text: 'Toast notification system' },
      { type: 'feature', text: 'User settings: profile, password, connected accounts' },
      { type: 'feature', text: 'Docker production deployment with Caddy' },
      { type: 'feature', text: 'GitHub Actions CI/CD pipeline' },
      { type: 'improvement', text: 'Closed Beta branding across all pages' },
      { type: 'fix', text: 'Wishlist deletion confirm dialog crash' },
      { type: 'fix', text: 'Authenticated users now redirect to dashboard from homepage' },
    ],
  },
  {
    version: '0.0.5-alpha',
    date: 'July 2026',
    badge: 'Previous',
    badgeVariant: 'secondary' as const,
    changes: [
      { type: 'feature', text: 'Background job queue with scheduler and worker' },
      { type: 'feature', text: 'Price history tracking with change detection' },
      { type: 'feature', text: 'Product fetch jobs with exponential backoff' },
      { type: 'feature', text: 'Admin products page with sync/refresh controls' },
      { type: 'feature', text: 'Product detail page with price stats' },
    ],
  },
  {
    version: '0.0.4-alpha',
    date: 'July 2026',
    badgeVariant: 'secondary' as const,
    changes: [
      { type: 'feature', text: 'Smart product import from any URL' },
      { type: 'feature', text: 'Metadata extraction: JSON-LD, OpenGraph, Twitter Cards' },
      { type: 'feature', text: 'URL normalization and tracking param removal' },
      { type: 'feature', text: 'Duplicate product detection via canonical URL' },
      { type: 'feature', text: 'Import preview with confirmation step' },
    ],
  },
  {
    version: '0.0.3-alpha',
    date: 'July 2026',
    badgeVariant: 'secondary' as const,
    changes: [
      { type: 'feature', text: 'Universal wishlists with full CRUD' },
      { type: 'feature', text: 'Wishlist items with priority, quantity, purchase status' },
      { type: 'feature', text: 'Public wishlist sharing via /u/[username]/wishlist/[slug]' },
      { type: 'feature', text: 'User dashboard with stats and recent activity' },
    ],
  },
  {
    version: '0.0.2-alpha',
    date: 'July 2026',
    badgeVariant: 'secondary' as const,
    changes: [
      { type: 'feature', text: 'Complete admin panel (users, invitations, waitlist, audit)' },
      { type: 'feature', text: 'Audit log with search and filters' },
      { type: 'feature', text: 'User management with role system' },
      { type: 'feature', text: 'Bulk waitlist operations' },
    ],
  },
  {
    version: '0.0.1-alpha',
    date: 'July 2026',
    badgeVariant: 'secondary' as const,
    changes: [
      { type: 'feature', text: 'Database-backed session authentication' },
      { type: 'feature', text: 'Invite-only registration system' },
      { type: 'feature', text: 'Argon2id password hashing' },
      { type: 'feature', text: 'Coming Soon landing page' },
    ],
  },
];

const typeColors: Record<string, string> = {
  feature: 'text-accent',
  improvement: 'text-success',
  fix: 'text-warning',
};

const typeLabels: Record<string, string> = {
  feature: 'New',
  improvement: 'Improved',
  fix: 'Fixed',
};

export default function ChangelogPage() {
  return (
    <div className="flex flex-col">
      <section className="border-b border-border py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">Changelog</Badge>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              What&apos;s new in DerList.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Every release, improvement, and fix — documented.
            </p>
          </AnimatedSection>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="relative flex flex-col gap-10 pl-6 before:absolute before:left-0 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
            {releases.map((release, i) => (
              <AnimatedSection key={release.version} variant="fade-up" delay={i * 60}>
                <div className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-background" />
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">{release.version}</h2>
                    <span className="text-xs text-muted-foreground">{release.date}</span>
                    {release.badge && <Badge variant={release.badgeVariant} className="text-[10px]">{release.badge}</Badge>}
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {release.changes.map((change, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className={`mt-0.5 shrink-0 text-[10px] font-semibold uppercase ${typeColors[change.type]}`}>
                          {typeLabels[change.type]}
                        </span>
                        {change.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
