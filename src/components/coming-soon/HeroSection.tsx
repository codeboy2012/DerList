import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GithubIcon } from '@/components/ui/brand-icons';
import { siteConfig } from '@/lib/site-config';
import { ArrowRight, ChevronDown, ShoppingBag } from 'lucide-react';

/**
 * HeroSection — the first thing visitors see.
 *
 * Contains:
 * - Floating ambient gradient orbs
 * - "Coming Soon" badge
 * - Large headline communicating what DerList is
 * - Sub-headline reinforcing the value prop from the README
 * - Two CTAs: Join Waitlist (scroll) + Learn More (scroll)
 * - GitHub star nudge
 * - Subtle scroll indicator chevron
 */
export function HeroSection() {
  return (
    <section
      aria-label="Hero"
      className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center overflow-hidden py-24 sm:py-32"
    >
      {/* ── Ambient background gradients ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* Top-left blue glow */}
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18)_0%,transparent_70%)] blur-3xl" />
        {/* Top-right soft violet accent */}
        <div className="absolute -right-32 top-16 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.10)_0%,transparent_70%)] blur-3xl" />
        {/* Center-bottom warmth */}
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(59,130,246,0.07)_0%,transparent_70%)] blur-2xl" />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(250,250,250,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(250,250,250,0.5) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
        {/* Badge */}
        <AnimatedSection variant="fade-in" delay={0}>
          <Badge
            variant="outline"
            className="mb-8 gap-2 border-accent/30 bg-accent/5 px-4 py-1.5 text-xs tracking-widest text-accent uppercase"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            Coming Soon
          </Badge>
        </AnimatedSection>

        {/* Brand mark */}
        <AnimatedSection variant="fade-up" delay={80}>
          <div className="mb-6 flex items-center justify-center gap-3">
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/20 shadow-lg shadow-accent/10"
            >
              <ShoppingBag className="h-6 w-6 text-accent" />
            </span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              {siteConfig.name}
            </span>
          </div>
        </AnimatedSection>

        {/* Primary headline */}
        <AnimatedSection variant="fade-up" delay={160}>
          <h1 className="text-balance text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-[5rem] lg:leading-[1.05]">
            The wishlist app{' '}
            <span className="bg-gradient-to-r from-accent via-blue-400 to-violet-400 bg-clip-text text-transparent">
              you actually deserve.
            </span>
          </h1>
        </AnimatedSection>

        {/* Sub-headline */}
        <AnimatedSection variant="fade-up" delay={240}>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Universal wishlists, live price tracking, a free PC builder, and smart product
            import — all in one fast, beautiful, completely{' '}
            <span className="font-medium text-foreground">free</span> and{' '}
            <span className="font-medium text-foreground">open-source</span> platform.
            No subscriptions. No ads. No paywalls. Ever.
          </p>
        </AnimatedSection>

        {/* CTA row */}
        <AnimatedSection variant="fade-up" delay={320}>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="min-w-48 gap-2 bg-accent text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent/90 hover:shadow-accent/30"
            >
              <a href="#waitlist">
                Join the Waitlist
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-w-48">
              <a href="#about">Learn More</a>
            </Button>
          </div>
        </AnimatedSection>

        {/* GitHub nudge */}
        <AnimatedSection variant="fade-in" delay={440}>
          <div className="mt-8 flex items-center gap-3">
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:border-border/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="View DerList on GitHub"
            >
              <GithubIcon className="h-3.5 w-3.5" aria-hidden />
              Open Source on GitHub
              <span className="text-border">·</span>
              <span className="text-accent">MIT License</span>
            </a>
          </div>
        </AnimatedSection>
      </div>

      {/* Scroll chevron */}
      <div aria-hidden className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="h-5 w-5 text-muted-foreground/40" />
      </div>
    </section>
  );
}
