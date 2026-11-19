import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Globe,
  Heart,
  Link2,
  Rocket,
  Search,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { siteConfig } from '@/lib/site-config';
import { Badge } from '@/components/ui/Badge';
import { GithubIcon } from '@/components/ui/brand-icons';
import { Button } from '@/components/ui/Button';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description:
    'A private, open-source wishlist and personal product organizer. Collections, target prices and notes — free forever.',
};

export default function HomePage() {
  return (
    <>
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center overflow-hidden px-4 py-24 sm:py-32">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="animate-pulse-glow absolute -top-40 -left-40 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,transparent_60%)] blur-3xl" />
          <div className="animate-pulse-glow absolute top-20 -right-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.08)_0%,transparent_60%)] blur-3xl delay-700" />
          <div className="absolute bottom-0 left-1/3 h-[500px] w-[800px] rounded-full bg-[radial-gradient(ellipse,rgba(59,130,246,0.06)_0%,transparent_60%)] blur-2xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <AnimatedSection variant="fade-in" delay={0}>
            <Badge
              variant="outline"
              className="border-accent/30 bg-accent/5 text-accent mb-8 gap-2 px-4 py-1.5 text-xs tracking-widest uppercase"
            >
              <span aria-hidden className="bg-accent h-1.5 w-1.5 animate-pulse rounded-full" />
              Open Beta — everyone can join
            </Badge>
          </AnimatedSection>

          <AnimatedSection variant="fade-up" delay={100}>
            <h1 className="text-foreground text-5xl font-bold tracking-tight text-balance sm:text-6xl md:text-7xl lg:text-[5.5rem] lg:leading-[1.05]">
              The wishlist app <span className="text-gradient">you deserve.</span>
            </h1>
          </AnimatedSection>

          <AnimatedSection variant="fade-up" delay={200}>
            <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-relaxed text-pretty sm:text-xl">
              Private collections, smart product import, target prices and personal notes — all in
              one fast, beautiful,{' '}
              <span className="text-foreground font-medium">completely free</span> platform.
              Registration is open to everyone.
            </p>
          </AnimatedSection>

          <AnimatedSection variant="fade-up" delay={300}>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="glow-accent min-w-52 gap-2">
                <Link href="/register">
                  Create free account
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-w-52">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </AnimatedSection>

          <AnimatedSection variant="fade-in" delay={450}>
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-card/60 text-muted-foreground hover:border-border-hover hover:text-foreground mt-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs backdrop-blur-sm transition-all"
            >
              <GithubIcon className="h-3.5 w-3.5" aria-hidden />
              Open Source · MIT License
            </a>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════ CORE FEATURES ═══════════════ */}
      <section id="features" className="border-border border-t py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <AnimatedSection variant="fade-up">
            <div className="flex flex-col items-center text-center">
              <Badge variant="secondary" className="mb-4">
                Features
              </Badge>
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need. Nothing you don&apos;t.
              </h2>
              <p className="text-muted-foreground mx-auto mt-4 max-w-xl">
                Built for people who want one app that actually works.
              </p>
            </div>
          </AnimatedSection>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coreFeatures.map((f, i) => (
              <AnimatedSection key={f.title} variant="fade-up" delay={80 + (i % 3) * 60}>
                <div className="group border-border bg-card hover:border-border-hover hover:bg-card-hover hover-lift flex h-full flex-col gap-3 rounded-2xl border p-6 transition-all duration-300">
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${f.bg} ring-1 ring-white/5`}
                  >
                    <f.icon className={`h-5 w-5 ${f.color}`} />
                  </span>
                  <h3 className="text-foreground text-sm font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">{f.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>

          <AnimatedSection variant="fade-up" delay={400}>
            <div className="mt-10 text-center">
              <Button asChild variant="outline" className="gap-2">
                <Link href="/features">
                  See all features <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════ WHY DERLIST ═══════════════ */}
      <section className="border-border bg-surface/30 border-t py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              Why DerList?
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl">
              Most wishlist tools are locked behind subscriptions, filled with ads, or limited to
              one store.
            </p>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={150}>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {pillars.map((p) => (
                <div
                  key={p.label}
                  className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border p-6"
                >
                  <span className="bg-accent/10 text-accent flex h-12 w-12 items-center justify-center rounded-xl">
                    <p.icon className="h-6 w-6" />
                  </span>
                  <h3 className="text-foreground text-sm font-semibold">{p.label}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">{p.description}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={300}>
            <div className="mt-8">
              <Button asChild variant="outline" className="gap-2">
                <Link href="/about">
                  Learn more about us <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════ SECURITY PREVIEW ═══════════════ */}
      <section className="border-border border-t py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <AnimatedSection variant="fade-up">
              <Badge variant="secondary" className="mb-4">
                Security
              </Badge>
              <h2 className="text-foreground text-3xl font-bold tracking-tight">
                Your data is safe.
              </h2>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                Argon2id password hashing, database-backed sessions with SHA-256 token hashing, PKCE
                OAuth, HttpOnly secure cookies, and rate-limited public registration.
              </p>
              <Button asChild variant="outline" className="mt-6 gap-2">
                <Link href="/security">
                  Read about our security <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </AnimatedSection>
            <AnimatedSection variant="fade-up" delay={150}>
              <div className="grid grid-cols-2 gap-3">
                {securityHighlights.map((s) => (
                  <div
                    key={s}
                    className="border-border bg-card flex items-center gap-2 rounded-lg border px-3 py-2.5"
                  >
                    <CheckCircle2 className="text-success h-3.5 w-3.5 shrink-0" />
                    <span className="text-foreground text-xs">{s}</span>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ═══════════════ OPEN SOURCE PREVIEW ═══════════════ */}
      <section className="border-border bg-surface/30 border-t py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">
              Open Source
            </Badge>
            <h2 className="text-foreground text-3xl font-bold tracking-tight">Built in public.</h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl">
              MIT licensed. Self-hostable. Fork it, audit it, contribute to it. The community owns
              DerList.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild className="gap-2">
                <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
                  <GithubIcon className="h-4 w-4" /> View on GitHub
                </a>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/open-source">
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════ ROADMAP PREVIEW ═══════════════ */}
      <section className="border-border border-t py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <AnimatedSection variant="fade-up">
            <div className="text-center">
              <Badge variant="secondary" className="mb-4">
                Roadmap
              </Badge>
              <h2 className="text-foreground text-3xl font-bold tracking-tight">
                What&apos;s next.
              </h2>
              <p className="text-muted-foreground mx-auto mt-4 max-w-xl">
                We&apos;re building DerList one phase at a time. Here&apos;s a preview.
              </p>
            </div>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={150}>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {roadmapPreview.map((item) => (
                <div
                  key={item.label}
                  className={`flex flex-col gap-2 rounded-xl border p-5 ${item.border}`}
                >
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-foreground text-xs font-semibold">{item.label}</span>
                  </div>
                  <ul className="space-y-1">
                    {item.items.map((t) => (
                      <li key={t} className="text-muted-foreground flex items-start gap-2 text-xs">
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
                <Link href="/roadmap">
                  View full roadmap <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section id="faq" className="border-border bg-surface/30 border-t py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <AnimatedSection variant="fade-up">
            <div className="text-center">
              <h2 className="text-foreground text-3xl font-bold tracking-tight">
                Frequently Asked Questions
              </h2>
            </div>
          </AnimatedSection>
          <div className="mt-10 space-y-3">
            {faqs.map((item, i) => (
              <AnimatedSection key={item.q} variant="fade-up" delay={50 + i * 40}>
                <details className="group border-border bg-card open:border-accent/20 open:bg-card-hover rounded-xl border transition-colors [&_summary]:cursor-pointer">
                  <summary className="text-foreground flex items-center justify-between gap-4 p-5 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="px-5 pt-0 pb-5">
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.a}</p>
                  </div>
                </details>
              </AnimatedSection>
            ))}
          </div>
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
  {
    icon: Heart,
    title: 'Private Collections',
    description:
      'Create unlimited collections with custom icons and colours. Everything is private to your account.',
    bg: 'bg-blue-500/10',
    color: 'text-blue-400',
  },
  {
    icon: Link2,
    title: 'Smart Product Import',
    description:
      'Paste a product URL — imported products keep the title, images, price and brand we can verify.',
    bg: 'bg-violet-500/10',
    color: 'text-violet-400',
  },
  {
    icon: TrendingDown,
    title: 'Target Prices',
    description:
      'Set the price you are waiting for and see it beside the current price on each item.',
    bg: 'bg-emerald-500/10',
    color: 'text-emerald-400',
  },
  {
    icon: ShoppingBag,
    title: 'Personal Details',
    description:
      'Record model, condition, availability, quantity, priority and private notes per product.',
    bg: 'bg-orange-500/10',
    color: 'text-orange-400',
  },
  {
    icon: Globe,
    title: 'Private by Design',
    description:
      'No public wishlist pages, no share links, no catalogue. Others cannot see your collections.',
    bg: 'bg-pink-500/10',
    color: 'text-pink-400',
  },
  {
    icon: Globe,
    title: 'Cross-Platform',
    description: 'Works everywhere. Mobile-first design that syncs across all your devices.',
    bg: 'bg-cyan-500/10',
    color: 'text-cyan-400',
  },
];

const pillars = [
  {
    icon: Zap,
    label: 'Free Forever',
    description: 'No subscriptions. No premium tiers. No ads. Every feature free for everyone.',
  },
  {
    icon: ShoppingBag,
    label: 'Store Agnostic',
    description: 'Works with any online store. Not limited to specific retailers.',
  },
  {
    icon: Search,
    label: 'Open Source',
    description: 'MIT licensed. Self-hostable. Audit the code. Own your data.',
  },
];

const securityHighlights = [
  'Argon2id Hashing',
  'Database Sessions',
  'PKCE OAuth',
  'HttpOnly Cookies',
  'Rate-Limited Signup',
  'Self-Hostable',
];

const roadmapPreview = [
  {
    icon: CheckCircle2,
    label: 'Available',
    color: 'text-success',
    border: 'border-success/30 bg-success/5',
    dot: 'bg-success',
    items: ['Private collections', 'Smart import', 'Product editor', 'Account export'],
  },
  {
    icon: Rocket,
    label: 'In Progress',
    color: 'text-accent',
    border: 'border-accent/30 bg-accent/5',
    dot: 'bg-accent',
    items: ['Import reliability', 'Accessibility', 'Mobile polish', 'Type safety'],
  },
  {
    icon: Sparkles,
    label: 'Planned',
    color: 'text-warning',
    border: 'border-warning/30 bg-warning/5',
    dot: 'bg-warning',
    items: ['Price history & alerts', 'Browser extension', 'Bulk export'],
  },
];

const faqs = [
  {
    q: 'Is DerList really free?',
    a: 'Yes — forever. No subscriptions, no premium plans, no advertisements, and no paywalls.',
  },
  {
    q: 'Who can use DerList?',
    a: 'Everyone. DerList is in Open Beta — create a free account with a username, an email address, GitHub or Google. No invitation or approval is needed.',
  },
  {
    q: 'Can I self-host DerList?',
    a: 'Absolutely. DerList is open source and designed to be self-hosted with Docker.',
  },
  {
    q: 'Which stores are supported?',
    a: 'DerList is store-agnostic. Smart Import works with any site that uses standard metadata (most major retailers).',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Every wishlist is private to your account, there is no public catalogue or sharing, and nothing is shared with other users.',
  },
];
