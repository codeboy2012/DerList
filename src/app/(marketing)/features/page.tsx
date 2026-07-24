import type { Metadata } from 'next';

import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { siteConfig } from '@/lib/site-config';
import {
  ArrowRight,
  Globe,
  Heart,
  Key,
  Link2,
  Monitor,
  Search,
  Share2,
  Shield,
  TrendingDown,
  Users,
  Zap,
} from 'lucide-react';

export const metadata: Metadata = {
  title: `Features — ${siteConfig.name}`,
  description: 'Explore every feature DerList offers — wishlists, price tracking, smart import, and more.',
};

const features = [
  {
    icon: Heart, title: 'Universal Wishlists', color: 'text-blue-400', bg: 'bg-blue-500/10',
    description: 'Create unlimited wishlists for any occasion — birthdays, holidays, gaming setups, or home projects. Organize with custom icons, colors, and privacy settings. Archive old lists and keep everything tidy.',
    bullets: ['Unlimited wishlists', 'Private, public, or unlisted', 'Custom icons & colors', 'Archive & organize'],
  },
  {
    icon: Link2, title: 'Smart Product Import', color: 'text-violet-400', bg: 'bg-violet-500/10',
    description: 'Paste any product URL and DerList automatically extracts the title, images, price, brand, retailer, availability, and specifications. No manual data entry required.',
    bullets: ['Paste any URL', 'Auto-extract metadata', 'JSON-LD & OpenGraph', 'Store-agnostic'],
  },
  {
    icon: TrendingDown, title: 'Live Price Tracking', color: 'text-emerald-400', bg: 'bg-emerald-500/10',
    description: 'DerList monitors prices automatically. View price history, see lowest and highest recorded prices, and know the best time to buy.',
    bullets: ['Automatic price monitoring', 'Price history charts', 'Lowest/highest tracking', 'Manual & scheduled refresh'],
  },
  {
    icon: Share2, title: 'Sharing & Collaboration', color: 'text-pink-400', bg: 'bg-pink-500/10',
    description: 'Share wishlists with beautiful public pages. Invite collaborators as editors or viewers. Perfect for group gifts and family wishlists.',
    bullets: ['Public shareable URLs', 'Collaborator roles', 'Beautiful share pages', 'Social-ready metadata'],
  },
  {
    icon: Key, title: 'Secure Authentication', color: 'text-amber-400', bg: 'bg-amber-500/10',
    description: 'Sign in with GitHub or Google, or use email and password. Sessions are database-backed with automatic renewal. Argon2id password hashing.',
    bullets: ['GitHub & Google OAuth', 'Database-backed sessions', 'Argon2id hashing', 'Invite-only registration'],
  },
  {
    icon: Monitor, title: 'PC Builder', color: 'text-orange-400', bg: 'bg-orange-500/10',
    badge: 'Coming Soon',
    description: 'Plan your perfect PC build with compatibility checking, live component pricing, and community builds. Completely free.',
    bullets: ['Compatibility checking', 'Live pricing', 'Community builds', 'Export & share'],
  },
  {
    icon: Globe, title: 'Cross-Platform', color: 'text-cyan-400', bg: 'bg-cyan-500/10',
    description: 'Works on every device and browser. Mobile-first design with native apps planned. Your data syncs everywhere.',
    bullets: ['Mobile-first design', 'Works on any browser', 'Native apps planned', 'Instant sync'],
  },
  {
    icon: Shield, title: 'Privacy & Security', color: 'text-red-400', bg: 'bg-red-500/10',
    description: 'Your data is yours. Private by default. No tracking, no ads, no selling your information. Self-hostable for full control.',
    bullets: ['Private by default', 'No ads or tracking', 'Self-hostable', 'MIT licensed'],
  },
  {
    icon: Zap, title: 'Free Forever', color: 'text-yellow-400', bg: 'bg-yellow-500/10',
    description: 'No subscriptions. No premium tiers. No paywalls. Every feature is available to every user at no cost, forever.',
    bullets: ['Zero cost', 'No premium tiers', 'No feature gating', 'Community supported'],
  },
];

export default function FeaturesPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative border-b border-border py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">Features</Badge>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Built for how you <span className="text-gradient">actually shop.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Every feature in DerList exists because we needed it ourselves. No bloat. No gimmicks. Just tools that work.
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
                <article className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-border-hover hover:bg-card-hover hover-lift">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${f.bg} ring-1 ring-white/5`}>
                      <f.icon className={`h-5 w-5 ${f.color}`} />
                    </span>
                    {f.badge && <Badge variant="warning" className="text-[10px]">{f.badge}</Badge>}
                  </div>
                  <h2 className="text-base font-semibold text-foreground">{f.title}</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                  <ul className="mt-auto space-y-1.5 pt-2">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={`h-1 w-1 rounded-full ${f.color.replace('text-', 'bg-')}`} />
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
      <section className="border-t border-border py-20 text-center">
        <AnimatedSection variant="fade-up">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Ready to try it?</h2>
          <p className="mt-3 text-muted-foreground">DerList is in closed beta. Request access today.</p>
          <Button asChild size="lg" className="mt-6 glow-sm">
            <Link href="/#beta-access">Request Beta Access <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </AnimatedSection>
      </section>
    </div>
  );
}
