import { Globe, Heart, Lock, Zap } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';
import { Badge } from '@/components/ui/Badge';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';

const pillars = [
  {
    icon: Heart,
    label: 'Free Forever',
    description:
      'No subscriptions, no premium tiers, no paywalls. Every feature is available to every user, always.',
  },
  {
    icon: Lock,
    label: 'Your Data, Your Rules',
    description:
      'DerList is fully self-hostable. Run your own instance and own 100% of your data with no vendor lock-in.',
  },
  {
    icon: Globe,
    label: 'Open Source',
    description:
      'MIT licensed and built entirely in public. Fork it, audit it, improve it — the community owns DerList.',
  },
  {
    icon: Zap,
    label: 'Built for Speed',
    description:
      'Instant page loads, optimised images, minimal JavaScript. Performance is a first-class feature, not an afterthought.',
  },
];

/**
 * AboutSection — communicates the mission and core philosophy of DerList.
 * All copy sourced directly from the README Mission and Design Philosophy sections.
 */
export function AboutSection() {
  return (
    <Section id="about" className="border-border bg-surface/30 border-t">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-6">
              Our Mission
            </Badge>
          </AnimatedSection>

          <AnimatedSection variant="fade-up" delay={80}>
            <h2 className="text-foreground text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              One app for everything you want to buy.
            </h2>
          </AnimatedSection>

          <AnimatedSection variant="fade-up" delay={160}>
            <p className="text-muted-foreground mt-6 text-lg leading-relaxed text-pretty">
              {siteConfig.name} exists to become the world&apos;s best free and open-source
              universal wishlist platform. Instead of juggling separate apps for wishlists, shopping
              lists, product details, notes, and collection management, DerList brings everything
              into one modern, beautiful application.
            </p>
          </AnimatedSection>

          <AnimatedSection variant="fade-up" delay={220}>
            <blockquote className="border-accent/20 bg-accent/5 mt-8 rounded-2xl border px-8 py-6">
              <p className="text-foreground text-xl leading-relaxed font-medium italic">
                &ldquo;Make shopping smarter, faster, and completely free.&rdquo;
              </p>
              <footer className="text-muted-foreground mt-3 text-sm">— The DerList Mission</footer>
            </blockquote>
          </AnimatedSection>
        </div>

        {/* Four-pillar grid */}
        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar, i) => (
            <AnimatedSection key={pillar.label} variant="fade-up" delay={80 + i * 80}>
              <div className="group border-border bg-card hover:border-accent/30 hover:bg-card/80 flex flex-col gap-4 rounded-2xl border p-6 transition-colors">
                <span
                  aria-hidden
                  className="bg-accent/10 text-accent ring-accent/20 group-hover:bg-accent/15 inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-colors"
                >
                  <pillar.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-foreground text-sm font-semibold">{pillar.label}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </Container>
    </Section>
  );
}
