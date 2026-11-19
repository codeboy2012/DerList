import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Globe,
  Heart,
  Key,
  Link2,
  Share2,
  Shield,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { siteConfig } from '@/lib/site-config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';

export const metadata: Metadata = {
  title: `Features — ${siteConfig.name}`,
  description:
    'What DerList actually does today — private collections, smart product import, personal product details and safe accounts.',
};

const features = [
  {
    icon: Heart,
    title: 'Universal Wishlists',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    description:
      'Create unlimited collections for any occasion — birthdays, holidays, gaming setups, or home projects. Organize with custom icons and colours, archive old lists, and keep everything tidy.',
    bullets: [
      'Unlimited collections',
      'Private to your account',
      'Custom icons & colours',
      'Archive & organize',
    ],
  },
  {
    icon: Link2,
    title: 'Smart Product Import',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    description:
      'Paste any product URL and DerList automatically extracts the title, images, price, brand, retailer, availability, and specifications. No manual data entry required.',
    bullets: ['Paste any URL', 'Auto-extract metadata', 'JSON-LD & OpenGraph', 'Store-agnostic'],
  },
  {
    icon: TrendingDown,
    title: 'Target Prices',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    description:
      'Record what a product costs today and the price you are waiting for. DerList never invents a price; values you have not supplied stay empty. Price history appears only when a refresh provider is configured.',
    bullets: [
      'Per-item target price',
      'Honest unknown values',
      'History when enabled',
      'No fake discounts',
    ],
  },
  {
    icon: Share2,
    title: 'Private by Design',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    description:
      'Collections are never public. There are no share links, public profiles or product catalogues, and every query is scoped to the signed-in account — including uploaded images.',
    bullets: [
      'No public pages',
      'No share links',
      'Owner-scoped uploads',
      'No cross-account search',
    ],
  },
  {
    icon: Key,
    title: 'Secure Authentication',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    description:
      'Create an account with a username, an email address, GitHub or Google, then sign in with any of them. Sessions are database-backed with automatic renewal and Argon2id password hashing.',
    bullets: [
      'Username or email signup',
      'GitHub & Google OAuth',
      'Database-backed sessions',
      'Open registration',
    ],
  },
  {
    icon: Globe,
    title: 'Cross-Platform',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    description:
      'Works on every device and browser. Mobile-first design with native apps planned. Your data syncs everywhere.',
    bullets: ['Mobile-first design', 'Works on any browser', 'Native apps planned', 'Instant sync'],
  },
  {
    icon: Shield,
    title: 'Privacy & Security',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    description:
      'Your data is yours. Private by default. No tracking, no ads, no selling your information. Self-hostable for full control.',
    bullets: ['Private by default', 'No ads or tracking', 'Self-hostable', 'MIT licensed'],
  },
  {
    icon: Zap,
    title: 'Free Forever',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    description:
      'No subscriptions. No premium tiers. No paywalls. Every feature is available to every user at no cost, forever.',
    bullets: ['Zero cost', 'No premium tiers', 'No feature gating', 'Community supported'],
  },
];

export default function FeaturesPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="border-border relative border-b py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">
              Features
            </Badge>
            <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Built for how you <span className="text-gradient">actually shop.</span>
            </h1>
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg">
              Every feature in DerList exists because we needed it ourselves. No bloat. No gimmicks.
              Just tools that work.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <AnimatedSection key={f.title} variant="fade-up" delay={80 + (i % 3) * 60}>
                <article className="group border-border bg-card hover:border-border-hover hover:bg-card-hover hover-lift flex h-full flex-col gap-4 rounded-2xl border p-6 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${f.bg} ring-1 ring-white/5`}
                    >
                      <f.icon className={`h-5 w-5 ${f.color}`} />
                    </span>
                  </div>
                  <h2 className="text-foreground text-base font-semibold">{f.title}</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
                  <ul className="mt-auto space-y-1.5 pt-2">
                    {f.bullets.map((b) => (
                      <li key={b} className="text-muted-foreground flex items-center gap-2 text-xs">
                        <span
                          className={`h-1 w-1 rounded-full ${f.color.replace('text-', 'bg-')}`}
                        />
                        {b}
                      </li>
                    ))}
                  </ul>
                </article>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-border border-t py-20 text-center">
        <AnimatedSection variant="fade-up">
          <h2 className="text-foreground text-2xl font-bold sm:text-3xl">Ready to try it?</h2>
          <p className="text-muted-foreground mt-3">
            DerList is in Open Beta and open to everyone. No invitation or approval is needed.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="glow-sm">
              <Link href="/register">
                Create free account <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </AnimatedSection>
      </section>
    </div>
  );
}
