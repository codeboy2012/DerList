import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { Badge } from '@/components/ui/Badge';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Check, Clock, Rocket, Sparkles } from 'lucide-react';

/**
 * Roadmap phases pulled directly from the README Roadmap section.
 */
const phases = [
  {
    status: 'Available at Launch' as const,
    statusLabel: 'Phase 1',
    icon: Check,
    color: 'border-success/50 bg-success/5',
    iconColor: 'text-success',
    dotColor: 'bg-success',
    items: [
      'Modern dark UI',
      'Authentication (Google & GitHub)',
      'Universal wishlists',
      'Smart product import',
      'Basic price tracking',
    ],
  },
  {
    status: 'Coming Soon' as const,
    statusLabel: 'Phase 2',
    icon: Rocket,
    color: 'border-accent/50 bg-accent/5',
    iconColor: 'text-accent',
    dotColor: 'bg-accent',
    items: [
      'Price history charts',
      'Notifications & alerts',
      'Public sharing',
      'Better search',
      'Product comparison',
    ],
  },
  {
    status: 'Coming Soon' as const,
    statusLabel: 'Phase 3',
    icon: Clock,
    color: 'border-warning/50 bg-warning/5',
    iconColor: 'text-warning',
    dotColor: 'bg-warning',
    items: [
      'Full PC builder',
      'Community builds',
      'Browser extension',
      'Mobile improvements',
    ],
  },
  {
    status: 'Future Vision' as const,
    statusLabel: 'Future',
    icon: Sparkles,
    color: 'border-violet-500/50 bg-violet-500/5',
    iconColor: 'text-violet-400',
    dotColor: 'bg-violet-400',
    items: [
      'Native desktop apps (Windows, macOS, Linux)',
      'Android & iOS apps',
      'Offline mode',
      'AI shopping assistant',
      'More store integrations',
    ],
  },
];

/**
 * RoadmapSection — clean vertical timeline showing project phases.
 */
export function RoadmapSection() {
  return (
    <Section id="roadmap" className="border-t border-border bg-surface/30">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-6">
              Roadmap
            </Badge>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={80}>
            <h2 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Where we&apos;re headed.
            </h2>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={160}>
            <p className="mt-4 text-lg text-muted-foreground">
              DerList is being built in public, one focused phase at a time.
              Here&apos;s what&apos;s planned.
            </p>
          </AnimatedSection>
        </div>

        {/* Timeline */}
        <div className="relative mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Connecting line (desktop) */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
          />

          {phases.map((phase, i) => (
            <AnimatedSection key={phase.statusLabel} variant="fade-up" delay={80 + i * 100}>
              <div
                className={`relative flex h-full flex-col rounded-2xl border p-6 ${phase.color}`}
              >
                {/* Phase indicator */}
                <div className="mb-4 flex items-center gap-3">
                  <span
                    aria-hidden
                    className={`flex h-8 w-8 items-center justify-center rounded-lg bg-card ring-1 ring-border ${phase.iconColor}`}
                  >
                    <phase.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{phase.statusLabel}</p>
                    <p className="text-sm font-semibold text-foreground">{phase.status}</p>
                  </div>
                </div>

                {/* Items */}
                <ul className="flex-1 space-y-2.5">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span
                        aria-hidden
                        className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${phase.dotColor}`}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </Container>
    </Section>
  );
}
