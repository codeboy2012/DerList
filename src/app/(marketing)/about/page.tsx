import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Globe, Heart, Lock, Zap } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';

export const metadata: Metadata = {
  title: `About — ${siteConfig.name}`,
  description: 'The mission behind DerList — building the best free universal wishlist platform.',
};

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="border-border border-b py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">
              About
            </Badge>
            <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
              One app for everything you want to buy.
            </h1>
            <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-lg">
              DerList exists because we were tired of juggling spreadsheets and store wishlists to
              remember what we actually wanted.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <AnimatedSection variant="fade-up">
            <div className="border-accent/20 bg-accent/5 rounded-2xl border px-8 py-8 text-center">
              <p className="text-foreground text-xl leading-relaxed font-medium italic">
                &ldquo;Make shopping smarter, faster, and completely free.&rdquo;
              </p>
              <p className="text-muted-foreground mt-3 text-sm">— The DerList Mission</p>
            </div>
          </AnimatedSection>

          <AnimatedSection variant="fade-up" delay={150}>
            <div className="text-muted-foreground mt-12 space-y-6 text-base leading-relaxed">
              <p>
                Most wishlist tools are locked behind subscriptions, cluttered with ads, or limited
                to a single retailer. We believe powerful software should be free, beautiful, and
                open to everyone.
              </p>
              <p>
                DerList is a universal wishlist platform that works with any store on the internet.
                Paste a product URL from Amazon, Best Buy, Newegg, Etsy, or anywhere else — DerList
                automatically imports all the details.
              </p>
              <p>
                DerList focuses on private collections: what you want, what it costs, what condition
                you want it in, and the notes that matter to you. Price history and alerts are
                planned rather than guaranteed today.
              </p>
              <p>
                Everything is <strong className="text-foreground">open source</strong>,{' '}
                <strong className="text-foreground">self-hostable</strong>, and{' '}
                <strong className="text-foreground">free forever</strong>. No venture capital. No
                investor pressure to monetize. Just a tool that does its job well.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Values */}
      <section className="border-border bg-surface/30 border-t py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <AnimatedSection variant="fade-up">
            <h2 className="text-foreground text-center text-2xl font-bold sm:text-3xl">
              Our Values
            </h2>
          </AnimatedSection>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {values.map((v, i) => (
              <AnimatedSection key={v.label} variant="fade-up" delay={80 + i * 60}>
                <div className="border-border bg-card flex gap-4 rounded-2xl border p-6">
                  <span className="bg-accent/10 text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <v.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-foreground text-sm font-semibold">{v.label}</h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      {v.description}
                    </p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-border border-t py-20 text-center">
        <AnimatedSection variant="fade-up">
          <h2 className="text-foreground text-2xl font-bold">Join the Open Beta</h2>
          <p className="text-muted-foreground mt-3">
            DerList is open to everyone. Create a free account and start your first collection.
          </p>
          <Button asChild size="lg" className="glow-sm mt-6">
            <Link href="/register">
              Create free account <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </AnimatedSection>
      </section>
    </div>
  );
}

const values = [
  {
    icon: Heart,
    label: 'Free Forever',
    description:
      'Every feature available to every user. No subscriptions, no ads, no premium tiers.',
  },
  {
    icon: Lock,
    label: 'Privacy First',
    description: 'Your data is yours. Private by default. No tracking pixels, no data selling.',
  },
  {
    icon: Globe,
    label: 'Open Source',
    description: 'MIT licensed. Fork it, audit it, self-host it. The community owns DerList.',
  },
  {
    icon: Zap,
    label: 'Performance',
    description: 'Instant page loads, minimal JavaScript, optimized queries. Speed is a feature.',
  },
];
