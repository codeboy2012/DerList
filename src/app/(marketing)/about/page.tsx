import type { Metadata } from 'next';

import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { siteConfig } from '@/lib/site-config';
import { ArrowRight, Globe, Heart, Lock, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: `About — ${siteConfig.name}`,
  description: 'The mission behind DerList — building the best free universal wishlist platform.',
};

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="border-b border-border py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">About</Badge>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              One app for everything you want to buy.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              DerList exists because we were tired of juggling separate apps for wishlists, price tracking, and PC building.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <AnimatedSection variant="fade-up">
            <div className="rounded-2xl border border-accent/20 bg-accent/5 px-8 py-8 text-center">
              <p className="text-xl font-medium italic leading-relaxed text-foreground">
                &ldquo;Make shopping smarter, faster, and completely free.&rdquo;
              </p>
              <p className="mt-3 text-sm text-muted-foreground">— The DerList Mission</p>
            </div>
          </AnimatedSection>

          <AnimatedSection variant="fade-up" delay={150}>
            <div className="mt-12 space-y-6 text-base leading-relaxed text-muted-foreground">
              <p>
                Most wishlist tools are locked behind subscriptions, cluttered with ads, or limited to a single retailer. We believe powerful software should be free, beautiful, and open to everyone.
              </p>
              <p>
                DerList is a universal wishlist platform that works with any store on the internet. Paste a product URL from Amazon, Best Buy, Newegg, Etsy, or anywhere else — DerList automatically imports all the details.
              </p>
              <p>
                Beyond wishlists, DerList tracks prices, monitors availability, and will eventually include a full PC builder with compatibility checking and community builds.
              </p>
              <p>
                Everything is <strong className="text-foreground">open source</strong>, <strong className="text-foreground">self-hostable</strong>, and <strong className="text-foreground">free forever</strong>. No venture capital. No investor pressure to monetize. Just a tool that does its job well.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-border bg-surface/30 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <AnimatedSection variant="fade-up">
            <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">Our Values</h2>
          </AnimatedSection>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {values.map((v, i) => (
              <AnimatedSection key={v.label} variant="fade-up" delay={80 + i * 60}>
                <div className="flex gap-4 rounded-2xl border border-border bg-card p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <v.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{v.label}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v.description}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20 text-center">
        <AnimatedSection variant="fade-up">
          <h2 className="text-2xl font-bold text-foreground">Join the Closed Beta</h2>
          <p className="mt-3 text-muted-foreground">Be among the first to experience DerList.</p>
          <Button asChild size="lg" className="mt-6 glow-sm">
            <Link href="/#beta-access">Request Access <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </AnimatedSection>
      </section>
    </div>
  );
}

const values = [
  { icon: Heart, label: 'Free Forever', description: 'Every feature available to every user. No subscriptions, no ads, no premium tiers.' },
  { icon: Lock, label: 'Privacy First', description: 'Your data is yours. Private by default. No tracking pixels, no data selling.' },
  { icon: Globe, label: 'Open Source', description: 'MIT licensed. Fork it, audit it, self-host it. The community owns DerList.' },
  { icon: Zap, label: 'Performance', description: 'Instant page loads, minimal JavaScript, optimized queries. Speed is a feature.' },
];
