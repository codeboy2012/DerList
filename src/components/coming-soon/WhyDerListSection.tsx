import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { Badge } from '@/components/ui/Badge';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { siteConfig } from '@/lib/site-config';
import { Ban, Check } from 'lucide-react';

/**
 * Comparison data sourced from the README "Why DerList?" section.
 */
const problems = [
  'Locked behind subscriptions',
  'Filled with advertisements',
  'Closed source',
  'Limited to specific stores',
  'Poor mobile experience',
  'Slow interfaces',
  'No self-hosting',
  'Limited customisation',
];

const derListAdvantages = [
  'Completely free, forever',
  'Zero advertisements',
  'Fully open source (MIT)',
  'Store-agnostic — any product URL',
  'Mobile-first, beautiful UI',
  'Instant page loads',
  'Self-hostable by anyone',
  'Unlimited customisation',
];

/**
 * WhyDerListSection — side-by-side comparison of existing tools vs DerList.
 * Directly derived from the README "Why DerList?" section.
 */
export function WhyDerListSection() {
  return (
    <Section id="why" className="border-t border-border">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-6">
              Why {siteConfig.name}?
            </Badge>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={80}>
            <h2 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              The problems with everyone else.
            </h2>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={160}>
            <p className="mt-4 max-w-xl mx-auto text-lg text-muted-foreground">
              There are plenty of wishlist apps, shopping trackers, and PC builders —
              but almost all of them share the same limitations.
            </p>
          </AnimatedSection>
        </div>

        {/* Comparison cards */}
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {/* Others */}
          <AnimatedSection variant="fade-left" delay={100}>
            <div className="h-full rounded-2xl border border-border bg-card p-8">
              <h3 className="text-sm font-semibold tracking-widest text-danger uppercase">
                Existing tools
              </h3>
              <ul className="mt-6 space-y-4">
                {problems.map((problem) => (
                  <li
                    key={problem}
                    className="flex items-center gap-3 text-sm text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-danger/10"
                    >
                      <Ban className="h-3 w-3 text-danger" />
                    </span>
                    {problem}
                  </li>
                ))}
              </ul>
            </div>
          </AnimatedSection>

          {/* DerList */}
          <AnimatedSection variant="fade-right" delay={100}>
            <div className="h-full rounded-2xl border border-accent/30 bg-accent/[0.03] p-8 ring-1 ring-accent/10">
              <h3 className="text-sm font-semibold tracking-widest text-accent uppercase">
                {siteConfig.name}
              </h3>
              <ul className="mt-6 space-y-4">
                {derListAdvantages.map((advantage) => (
                  <li
                    key={advantage}
                    className="flex items-center gap-3 text-sm text-foreground"
                  >
                    <span
                      aria-hidden
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-success/10"
                    >
                      <Check className="h-3 w-3 text-success" />
                    </span>
                    {advantage}
                  </li>
                ))}
              </ul>
            </div>
          </AnimatedSection>
        </div>

        {/* Philosophy callout */}
        <AnimatedSection variant="fade-up" delay={200}>
          <div className="mx-auto mt-14 max-w-2xl text-center">
            <blockquote className="text-lg font-medium italic text-foreground">
              &ldquo;Powerful software should be free, beautiful, open, and accessible to everyone.&rdquo;
            </blockquote>
          </div>
        </AnimatedSection>
      </Container>
    </Section>
  );
}
