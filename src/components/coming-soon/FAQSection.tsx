import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { Badge } from '@/components/ui/Badge';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { siteConfig } from '@/lib/site-config';
import { ChevronRight } from 'lucide-react';

/**
 * FAQ content sourced from the README.
 */
const faqs = [
  {
    q: 'Is DerList really free?',
    a: 'Yes — forever. There are no subscriptions, no premium plans, no advertisements, and no paywalls. Every feature is available to every user at no cost.',
  },
  {
    q: 'Is DerList open source?',
    a: `DerList is fully open source under the MIT license. The entire codebase is public on GitHub. You're free to fork, modify, self-host, learn from, and improve it.`,
  },
  {
    q: 'Can I self-host DerList?',
    a: 'Absolutely. DerList is designed to be self-hostable. You can run your own instance and maintain complete ownership of your data. Docker support is also planned.',
  },
  {
    q: 'Which stores are supported?',
    a: `DerList is store-agnostic. Smart Product Import works by pasting any product URL — it's not limited to a specific set of retailers. Support grows with each release.`,
  },
  {
    q: 'What platforms does DerList support?',
    a: 'DerList works in any modern browser on Windows, macOS, Linux, ChromeOS, iOS, iPadOS, and Android. Native desktop and mobile apps are on the future roadmap.',
  },
  {
    q: 'How is DerList different from other wishlist apps?',
    a: 'Most alternatives are either subscription-locked, filled with ads, or limited to specific stores. DerList is open, store-agnostic, fully free, and combines wishlists, price tracking, and a PC builder in one tool.',
  },
  {
    q: 'How can I contribute?',
    a: 'Contributions of all sizes are welcome — from fixing typos to submitting features. Visit the GitHub repository, open an issue, or submit a pull request.',
  },
  {
    q: 'When will DerList launch?',
    a: `DerList is in active development. Join the waitlist to be notified when it's ready. You can follow progress on GitHub.`,
  },
];

/**
 * FAQSection — accessible accordion FAQ using native <details>.
 */
export function FAQSection() {
  return (
    <Section id="faq" className="border-t border-border">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-6">
              FAQ
            </Badge>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={80}>
            <h2 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Frequently asked questions.
            </h2>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={160}>
            <p className="mt-4 text-lg text-muted-foreground">
              Everything you need to know about {siteConfig.name}.
            </p>
          </AnimatedSection>
        </div>

        <div className="mx-auto mt-14 max-w-3xl space-y-3">
          {faqs.map((item, i) => (
            <AnimatedSection key={item.q} variant="fade-up" delay={60 + (i % 4) * 50}>
              <details className="group rounded-xl border border-border bg-card transition-colors open:border-accent/30 open:bg-card/80 [&_summary]:cursor-pointer">
                <summary className="flex items-center justify-between gap-4 p-5 text-sm font-medium text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronRight
                    className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90"
                    aria-hidden
                  />
                </summary>
                <div className="px-5 pb-5 pt-0">
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
              </details>
            </AnimatedSection>
          ))}
        </div>
      </Container>
    </Section>
  );
}
