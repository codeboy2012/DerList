import { Globe, Heart, Link2, ListChecks, Package, Share2, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';

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
      'Private to your account',
      'Folder organisation',
      'Custom tags & priorities',
    ],
    accent: 'from-blue-500/20 to-blue-600/5',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
  },
  {
    icon: TrendingDown,
    title: 'Target Prices',
    description:
      'Record the current price and the price you are waiting for on every product. Automated history is optional and only appears when a price provider and the background worker are configured.',
    highlights: [
      'Per-item target price',
      'Honest unknown values',
      'Price history (when enabled)',
      'Private to your account',
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
    icon: Package,
    title: 'Personal Product Details',
    description:
      'Keep the details that belong to your copy of a product — model, condition, availability, quantity, priority and private notes — next to the imported catalogue data.',
    highlights: [
      'Condition & availability',
      'Quantity & priority',
      'Private notes',
      'Move between collections',
    ],
    accent: 'from-orange-500/20 to-orange-600/5',
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/10',
  },
  {
    icon: Share2,
    title: 'Private by Design',
    description:
      'Every collection is private to your account. There are no public wishlist pages, share links or catalogues, and no other account can search or open your products.',
    highlights: [
      'No public pages',
      'No share links',
      'Owner-only uploads',
      'No cross-account search',
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
    <Section id="features" className="border-border border-t">
      <Container>
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-6">
              Features
            </Badge>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={80}>
            <h2 className="text-foreground text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Everything you need. Nothing you don&apos;t.
            </h2>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={160}>
            <p className="text-muted-foreground mt-4 text-lg">
              DerList combines private collections, smart import and personal product details into
              one fast, free application.
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
              <article className="group border-border bg-card hover:border-border/60 relative flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20">
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
                    <h3 className="text-foreground text-base font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>

                  {/* Highlight list */}
                  <ul className="mt-auto space-y-1.5 pt-2">
                    {feature.highlights.map((h) => (
                      <li key={h} className="text-muted-foreground flex items-center gap-2 text-xs">
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
