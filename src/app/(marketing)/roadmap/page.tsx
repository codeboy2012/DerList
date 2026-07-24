import type { Metadata } from 'next';

import { Badge } from '@/components/ui/Badge';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { siteConfig } from '@/lib/site-config';
import { Check, Clock, Rocket, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: `Roadmap — ${siteConfig.name}`,
  description: 'See what we\u2019re building next. DerList roadmap and upcoming features.',
};

const phases = [
  {
    status: 'Released', icon: Check, color: 'border-success/40 bg-success/5', dot: 'bg-success', iconColor: 'text-success',
    items: [
      'Custom database-backed authentication',
      'GitHub & Google OAuth',
      'Invite-only beta system',
      'Universal wishlists (CRUD, archive, share)',
      'Smart product import (JSON-LD, OG, meta)',
      'Live price tracking & history',
      'Background job queue & scheduler',
      'Full admin panel',
      'Audit logging',
      'Docker deployment',
      'CI/CD pipeline',
    ],
  },
  {
    status: 'In Progress', icon: Rocket, color: 'border-accent/40 bg-accent/5', dot: 'bg-accent', iconColor: 'text-accent',
    items: [
      'Premium UI redesign',
      'Command palette (Ctrl+K)',
      'Toast notification system',
      'User settings & profile',
      'Marketing website expansion',
      'Mobile navigation improvements',
    ],
  },
  {
    status: 'Coming Soon', icon: Clock, color: 'border-warning/40 bg-warning/5', dot: 'bg-warning', iconColor: 'text-warning',
    items: [
      'Price drop alerts & notifications',
      'Wishlist collaboration (invite editors)',
      'Wishlist folders & organization',
      'Browser extension',
      'Product comparison',
      'Advanced search & filters',
      'CSV/JSON export',
    ],
  },
  {
    status: 'Future', icon: Sparkles, color: 'border-violet-500/40 bg-violet-500/5', dot: 'bg-violet-400', iconColor: 'text-violet-400',
    items: [
      'PC Builder with compatibility checking',
      'Native desktop apps (Windows, macOS, Linux)',
      'Android & iOS apps',
      'AI shopping assistant',
      'Retailer-specific adapters',
      'Public API',
      'Offline mode',
      'Multi-language support',
    ],
  },
];

export default function RoadmapPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="border-b border-border py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">Roadmap</Badge>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Where we&apos;re headed.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              DerList is built in public, one focused phase at a time. Here&apos;s what&apos;s done and what&apos;s next.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Phases */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex flex-col gap-8">
            {phases.map((phase, i) => (
              <AnimatedSection key={phase.status} variant="fade-up" delay={i * 100}>
                <div className={`rounded-2xl border p-6 sm:p-8 ${phase.color}`}>
                  <div className="mb-5 flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-card ring-1 ring-border ${phase.iconColor}`}>
                      <phase.icon className="h-4 w-4" />
                    </span>
                    <h2 className="text-lg font-semibold text-foreground">{phase.status}</h2>
                    <Badge variant="outline" className="text-[10px]">
                      {phase.items.length} items
                    </Badge>
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {phase.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${phase.dot}`} />
                        {item}
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
