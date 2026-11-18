import { Check, Clock, Rocket, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';

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
      'Private collections',
      'Smart product import',
      'Price history data model',
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
      'Price history charts (provider required)',
      'Notifications & alerts',
      'Bulk import & export',
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
    items: ['Browser extension', 'Mobile improvements', 'Bulk editing', 'Saved filters'],
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
    <Section id="roadmap" className="border-border bg-surface/30 border-t">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-6">
              Roadmap
            </Badge>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={80}>
            <h2 className="text-foreground text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Where we&apos;re headed.
            </h2>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={160}>
            <p className="text-muted-foreground mt-4 text-lg">
              DerList is being built in public, one focused phase at a time. Here&apos;s what&apos;s
              planned.
            </p>
          </AnimatedSection>
        </div>

        {/* Timeline */}
        <div className="relative mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Connecting line (desktop) */}
          <div
            aria-hidden
            className="via-border absolute top-6 right-0 left-0 hidden h-px bg-gradient-to-r from-transparent to-transparent lg:block"
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
                    className={`bg-card ring-border flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${phase.iconColor}`}
                  >
                    <phase.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">{phase.statusLabel}</p>
                    <p className="text-foreground text-sm font-semibold">{phase.status}</p>
                  </div>
                </div>

                {/* Items */}
                <ul className="flex-1 space-y-2.5">
                  {phase.items.map((item) => (
                    <li key={item} className="text-muted-foreground flex items-start gap-2 text-sm">
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
