'use client';

import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Container } from '@/components/ui/Container';
import { Input } from '@/components/ui/Input';
import { Section } from '@/components/ui/Section';
import { Select } from '@/components/ui/Select';
import { siteConfig } from '@/lib/site-config';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useCallback, useState, type FormEvent } from 'react';

const excitedOptions = [
  'Universal Wishlists',
  'Live Price Tracking',
  'Smart Product Import',
  'Free PC Builder',
  'Sharing & Collaboration',
  'Self-Hosting',
  'All of the above',
];

/**
 * WaitlistSection — UI-only waitlist form.
 *
 * No backend functionality — uses placeholder submission logic that
 * shows a success state. Ready to be wired up to any backend later.
 */
export function WaitlistSection() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Placeholder: simulate submission
    setSubmitted(true);
  }, []);

  return (
    <Section id="waitlist" className="border-t border-border bg-surface/30">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <AnimatedSection variant="fade-up">
            <h2 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Be first in line.
            </h2>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={80}>
            <p className="mt-4 text-lg text-muted-foreground">
              {siteConfig.name} is launching soon. Join the waitlist to get early access and
              help shape the product.
            </p>
          </AnimatedSection>
        </div>

        <AnimatedSection variant="fade-up" delay={160}>
          <div className="mx-auto mt-12 max-w-md">
            {submitted ? (
              /* Success state */
              <div
                role="status"
                className="flex flex-col items-center gap-4 rounded-2xl border border-success/30 bg-success/5 p-10 text-center"
              >
                <span
                  aria-hidden
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success"
                >
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <h3 className="text-lg font-semibold text-foreground">
                  You&apos;re on the list!
                </h3>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll let you know when {siteConfig.name} is ready. In the meantime,
                  check out the{' '}
                  <a
                    href={siteConfig.links.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline underline-offset-2 hover:text-accent/80"
                  >
                    GitHub repository
                  </a>
                  .
                </p>
              </div>
            ) : (
              /* Form */
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-8"
                aria-label="Waitlist signup form"
                noValidate
              >
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="waitlist-name" className="text-sm font-medium text-foreground">
                    Name
                  </label>
                  <Input
                    id="waitlist-name"
                    name="name"
                    required
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="waitlist-email" className="text-sm font-medium text-foreground">
                    Email
                  </label>
                  <Input
                    id="waitlist-email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                {/* Interest */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="waitlist-interest" className="text-sm font-medium text-foreground">
                    What are you most excited about?
                  </label>
                  <Select id="waitlist-interest" name="interest" defaultValue="">
                    <option value="" disabled>
                      Select an option
                    </option>
                    {excitedOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Newsletter */}
                <Checkbox
                  name="newsletter"
                  label="Subscribe to the newsletter"
                  description="Get product updates and launch announcements."
                  defaultChecked
                />

                {/* Submit */}
                <Button
                  type="submit"
                  size="lg"
                  className="mt-2 w-full gap-2 bg-accent text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent/90"
                >
                  Join the Waitlist
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  We respect your privacy. No spam, ever.
                </p>
              </form>
            )}
          </div>
        </AnimatedSection>
      </Container>
    </Section>
  );
}
