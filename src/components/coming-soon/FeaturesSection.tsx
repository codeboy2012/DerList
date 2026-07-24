import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { Badge } from '@/components/ui/Badge';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import {
  Globe,
  Heart,
  Link2,
  ListChecks,
  Monitor,
  Share2,
  TrendingDown,
} from 'lucide-react';

/**
 * Feature data sourced exclusively from the README Features section.
 */
const features = [
  {
    icon: ListChecks,
    title: 'Universal Wishlists',
    description:
      'Create unlimited wishlists for birthdays, holidays, gaming setups, home projects, and more. Private, public, secret, or shared — organise with folders, tags, priorities, and notes.',
    highlights: [
      'Unlimited lists & products',
      'Private, public & secret modes',
      'Folder organisation',
      'Custom tags & priorities',
    ],
    accent: 'from-blue-500/20 to-blue-600/5',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
  },
  {
    icon: TrendingDown,
    title: 'Live Price Tracking',
    description:
      'DerList automatically tracks product prices from supported stores. View price history charts, see the lowest and highest recorded prices, and never miss a deal.',
    highlights: [
      'Live price updates',
      'Historical price charts',
      'Lowest & average price records',
      'Price drop alerts (planned)',
    ],
    accent: 'from-emerald-500/20 to-emerald-600/5',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
  },
  {
    icon: Link2,
    title: 'Smart Product Import',
    description:
      'Paste a product URL — DerList does the rest. It automatically pulls in the title, images, brand, store, price, description, specifications, variants, and availability.',
    highlights: [
      'Paste any product URL',
      'Auto-imports title, images, price',
      'Specs, variants & availability',
      'No manual setup required',
    ],
    accent: 'from-violet-500/20 to-violet-600/5',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
  },
  {
    icon: Monitor,
    title: 'Free PC Builder',
    description:
      'Plan your perfect build without paying for a tool to do it. Includes full custom builds, compatibility checking, live component pricing, multiple saved builds, and easy sharing.',
    highlights: [
      'Full custom builds',
      'Compatibility checking',
      'Live component pricing',
      'Build sharing',
    ],
    accent: 'from-orange-500/20 to-orange-600/5',
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/10',
  },
  {
    icon: Share2,
    title: 'Sharing',
    description:
      'Share wishlists, PC builds, and products with anyone. Public, private, and shared visibility modes give you full control over who can see your lists.',
    highlights: [
      'Public wishlists & builds',
      'Private & shared modes',
      'Shareable URLs',
      'Product links',
    ],
    accent: 'from-pink-500/20 to-pink-600/5',
    iconColor: 'text-pink-400',
    iconBg: 'bg-pink-500/10',
  },
  {
    icon: Globe,
    title: 'Cross-Platform',
    description:
      'DerList is built mobile-first and runs beautifully on every device — Windows, macOS, Linux, ChromeOS, iOS, iPadOS, and Android. Your lists follow you everywhere.',
    highlights: [
      'Works on any modern browser',
      'Mobile-first design',
      'Sync across devices',
      'Native apps planned',
    ],
    accent: 'from-cyan-500/20 to-cyan-600/5',
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10',
  },
  {
    icon: Heart,
    title: 'Free Forever',
    description:
      'No subscriptions. No premium plans. No advertisements. No paywalls. DerList is, and always will be, completely free for every user on the planet.',
    highlights: [
      'Zero subscriptions, ever',
      'No ads or tracking pixels',
      'Self-hostable',
      'MIT licensed',
    ],
    accent: 'from-red-500/20 to-red-600/5',
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/10',
  },
];

/**
 * FeaturesSection — a card grid showcasing every feature described in the README.
 */
export function FeaturesSection() {
  return (
    <Section id="features" className="border-t border-border">
      <Container>
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-6">
              Features
            </Badge>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={80}>
            <h2 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Everything you need. Nothing you don&apos;t.
            </h2>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={160}>
            <p className="mt-4 text-lg text-muted-foreground">
              DerList combines wishlists, price tracking, smart import, and a PC builder
              into one fast, free application — with more on the way.
            </p>
          </AnimatedSection>
        </div>

        {/* Feature cards */}
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <AnimatedSection
              key={feature.title}
              variant="fade-up"
              delay={80 + (i % 3) * 80}
              threshold={0.05}
            >
              <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-border/60 hover:shadow-xl hover:shadow-black/20">
                {/* Gradient wash */}
                <div
                  aria-hidden
                  className={`absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                />

                <div className="relative flex flex-col gap-4 p-6">
                  {/* Icon */}
                  <span
                    aria-hidden
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${feature.iconBg} ring-1 ring-white/5`}
                  >
                    <feature.icon className={`h-5 w-5 ${feature.iconColor}`} />
                  </span>

                  {/* Copy */}
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>

                  {/* Highlight list */}
                  <ul className="mt-auto space-y-1.5 pt-2">
                    {feature.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span
                          aria-hidden
                          className={`h-1 w-1 flex-shrink-0 rounded-full ${feature.iconColor.replace('text-', 'bg-')}`}
                        />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </AnimatedSection>
          ))}
        </div>
      </Container>
    </Section>
  );
}
