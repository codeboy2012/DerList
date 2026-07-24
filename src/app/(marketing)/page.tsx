import Link from 'next/link';
import type { Metadata } from 'next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { GithubIcon } from '@/components/ui/brand-icons';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { siteConfig } from '@/lib/site-config';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Code,
  Globe,
  Heart,
  Key,
  Link2,
  Monitor,
  Rocket,
  Search,
  Share2,
  Shield,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  Zap,
} from 'lucide-react';

import { BetaAccessForm } from './BetaAccessForm';

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: 'The modern, open-source universal wishlist, shopping planner and PC builder. Free forever.',
};

export default function HomePage() {
  return (
    <>
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center overflow-hidden px-4 py-24 sm:py-32">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-40 -top-40 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,transparent_60%)] blur-3xl animate-pulse-glow" />
          <div className="absolute -right-40 top-20 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.08)_0%,transparent_60%)] blur-3xl animate-pulse-glow delay-700" />
          <div className="absolute bottom-0 left-1/3 h-[500px] w-[800px] rounded-full bg-[radial-gradient(ellipse,rgba(59,130,246,0.06)_0%,transparent_60%)] blur-2xl" />
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <AnimatedSection variant="fade-in" delay={0}>
            <Badge variant="outline" className="mb-8 gap-2 border-accent/30 bg-accent/5 px-4 py-1.5 text-xs tracking-widest text-accent uppercase">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Closed Beta
            </Badge>
          </AnimatedSection>

          <AnimatedSection variant="fade-up" delay={100}>
            <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-[5.5rem] lg:leading-[1.05]">
              The wishlist app{' '}
              <span className="text-gradient">you deserve.</span>
            </h1>
          </AnimatedSection>

          <AnimatedSection variant="fade-up" delay={200}>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Universal wishlists, live price tracking, smart product import, and a free PC builder —
              all in one fast, beautiful,{' '}
              <span className="text-foreground font-medium">completely free</span> platform.
            </p>
          </AnimatedSection>

          <AnimatedSection variant="fade-up" delay={300}>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="min-w-52 gap-2 glow-accent">
                <a href="#beta-access">
                  Request Beta Access
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-w-52">
                <Link href="/features">Explore Features</Link>
              </Button>
            </div>
          </AnimatedSection>

          <AnimatedSection variant="fade-in" delay={450}>
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs text-muted-foreground backdrop-blur-sm transition-all hover:border-border-hover hover:text-foreground"
            >
              <GithubIcon className="h-3.5 w-3.5" aria-hidden />
              Open Source · MIT License
            </a>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════ CORE FEATURES ═══════════════ */}
      <section id="features" className="border-t border-border py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <AnimatedSection variant="fade-up">
            <div className="flex flex-col items-center text-center">
              <Badge variant="secondary" className="mb-4">Features</Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Everything you need. Nothing you don&apos;t.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Built for people who want one app that actually works.
              </p>
            </div>
          </AnimatedSection>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coreFeatures.map((f, i) => (
              <AnimatedSection key={f.title} variant="fade-up" delay={80 + (i % 3) * 60}>
                <div className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-border-hover hover:bg-card-hover hover-lift">
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${f.bg} ring-1 ring-white/5`}>
                    <f.icon className={`h-5 w-5 ${f.color}`} />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{f.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection variant="fade-up" delay={400}>
            <div className="mt-10 text-center">
              <Button asChild variant="outline" className="gap-2">
                <Link href="/features">See all features <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════ WHY DERLIST ═══════════════ */}
      <section className="border-t border-border bg-surface/30 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Why DerList?</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Most wishlist tools are locked behind subscriptions, filled with ads, or limited to one store.
            </p>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={150}>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {pillars.map((p) => (
                <div key={p.label} className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <p.icon className="h-6 w-6" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{p.label}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{p.description}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={300}>
            <div className="mt-8">
              <Button asChild variant="outline" className="gap-2">
                <Link href="/about">Learn more about us <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════ SECURITY PREVIEW ═══════════════ */}
      <section className="border-t border-border py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <AnimatedSection variant="fade-up">
              <Badge variant="secondary" className="mb-4">Security</Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Your data is safe.</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Argon2id password hashing, database-backed sessions with SHA-256 token hashing,
                PKCE OAuth, HttpOnly secure cookies, and invite-only access control.
              </p>
              <Button asChild variant="outline" className="mt-6 gap-2">
                <Link href="/security">Read about our security <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </AnimatedSection>
            <AnimatedSection variant="fade-up" delay={150}>
              <div className="grid grid-cols-2 gap-3">
                {securityHighlights.map((s) => (
                  <div key={s} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                    <span className="text-xs text-foreground">{s}</span>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ═══════════════ OPEN SOURCE PREVIEW ═══════════════ */}
      <section className="border-t border-border bg-surface/30 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">Open Source</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Built in public.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              MIT licensed. Self-hostable. Fork it, audit it, contribute to it. The community owns DerList.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild className="gap-2">
                <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
                  <GithubIcon className="h-4 w-4" /> View on GitHub
                </a>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/open-source">Learn more <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════ ROADMAP PREVIEW ═══════════════ */}
      <section className="border-t border-border py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <AnimatedSection variant="fade-up">
            <div className="text-center">
              <Badge variant="secondary" className="mb-4">Roadmap</Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">What&apos;s next.</h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                We&apos;re building DerList one phase at a time. Here&apos;s a preview.
              </p>
            </div>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={150}>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {roadmapPreview.map((item) => (
                <div key={item.label} className={`flex flex-col gap-2 rounded-xl border p-5 ${item.border}`}>
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-xs font-semibold text-foreground">{item.label}</span>
                  </div>
                  <ul className="space-y-1">
                    {item.items.map((t) => (
                      <li key={t} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${item.dot}`} />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={300}>
            <div className="mt-8 text-center">
              <Button asChild variant="outline" className="gap-2">
                <Link href="/roadmap">View full roadmap <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section id="faq" className="border-t border-border bg-surface/30 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <AnimatedSection variant="fade-up">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Frequently Asked Questions</h2>
            </div>
          </AnimatedSection>
          <div className="mt-10 space-y-3">
            {faqs.map((item, i) => (
              <AnimatedSection key={item.q} variant="fade-up" delay={50 + i * 40}>
                <details className="group rounded-xl border border-border bg-card transition-colors open:border-accent/20 open:bg-card-hover [&_summary]:cursor-pointer">
                  <summary className="flex items-center justify-between gap-4 p-5 text-sm font-medium text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="text-muted-foreground transition-transform duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <div className="px-5 pb-5 pt-0">
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                  </div>
                </details>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ BETA ACCESS ═══════════════ */}
      <section id="beta-access" className="relative border-t border-border py-24 sm:py-32">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(59,130,246,0.08)_0%,transparent_70%)] blur-3xl" />
        </div>
        <div className="mx-auto max-w-lg px-4 sm:px-6 text-center">
          <AnimatedSection variant="fade-up">
            <Badge variant="outline" className="mb-4 border-accent/30 text-accent">Closed Beta</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Request Beta Access
            </h2>
            <p className="mt-3 text-muted-foreground">
              DerList is currently invite-only. Request access and we&apos;ll send you an invitation when a spot opens.
            </p>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={150}>
            <div className="mt-8">
              <BetaAccessForm />
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: siteConfig.name,
            url: siteConfig.url,
            description: siteConfig.description,
            applicationCategory: 'ShoppingApplication',
            operatingSystem: 'Any',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            isAccessibleForFree: true,
          }),
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

const coreFeatures = [
  { icon: Heart, title: 'Universal Wishlists', description: 'Create unlimited wishlists for any occasion. Organize with icons, colors, and privacy settings.', bg: 'bg-blue-500/10', color: 'text-blue-400' },
  { icon: Link2, title: 'Smart Product Import', description: 'Paste any product URL — we automatically pull title, images, price, brand, and more.', bg: 'bg-violet-500/10', color: 'text-violet-400' },
  { icon: TrendingDown, title: 'Live Price Tracking', description: 'Automatic price monitoring with history charts. Know when to buy at the lowest price.', bg: 'bg-emerald-500/10', color: 'text-emerald-400' },
  { icon: Monitor, title: 'Free PC Builder', description: 'Plan builds with compatibility checking, live pricing, and community sharing.', bg: 'bg-orange-500/10', color: 'text-orange-400' },
  { icon: Share2, title: 'Share Anywhere', description: 'Public, private, or unlisted wishlists. Beautiful public pages for sharing.', bg: 'bg-pink-500/10', color: 'text-pink-400' },
  { icon: Globe, title: 'Cross-Platform', description: 'Works everywhere. Mobile-first design that syncs across all your devices.', bg: 'bg-cyan-500/10', color: 'text-cyan-400' },
];

const pillars = [
  { icon: Zap, label: 'Free Forever', description: 'No subscriptions. No premium tiers. No ads. Every feature free for everyone.' },
  { icon: ShoppingBag, label: 'Store Agnostic', description: 'Works with any online store. Not limited to specific retailers.' },
  { icon: Search, label: 'Open Source', description: 'MIT licensed. Self-hostable. Audit the code. Own your data.' },
];

const securityHighlights = ['Argon2id Hashing', 'Database Sessions', 'PKCE OAuth', 'HttpOnly Cookies', 'Invite-Only', 'Self-Hostable'];

const roadmapPreview = [
  { icon: CheckCircle2, label: 'Released', color: 'text-success', border: 'border-success/30 bg-success/5', dot: 'bg-success', items: ['Universal wishlists', 'Smart import', 'Price tracking', 'Admin panel'] },
  { icon: Rocket, label: 'In Progress', color: 'text-accent', border: 'border-accent/30 bg-accent/5', dot: 'bg-accent', items: ['Premium UI', 'Command palette', 'OAuth login', 'Marketing site'] },
  { icon: Sparkles, label: 'Coming Soon', color: 'text-warning', border: 'border-warning/30 bg-warning/5', dot: 'bg-warning', items: ['Price alerts', 'Collaboration', 'Browser extension', 'PC Builder'] },
];

const faqs = [
  { q: 'Is DerList really free?', a: 'Yes — forever. No subscriptions, no premium plans, no advertisements, and no paywalls.' },
  { q: 'When will I get beta access?', a: 'We send invitations in waves as we scale. Request access and we\u2019ll notify you when your spot is ready.' },
  { q: 'Can I self-host DerList?', a: 'Absolutely. DerList is open source and designed to be self-hosted with Docker.' },
  { q: 'Which stores are supported?', a: 'DerList is store-agnostic. Smart Import works with any site that uses standard metadata (most major retailers).' },
  { q: 'Is my data private?', a: 'Your wishlists are private by default. You control visibility. We never sell data or show ads.' },
];
