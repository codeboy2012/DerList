import type { Metadata } from 'next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GithubIcon } from '@/components/ui/brand-icons';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { siteConfig } from '@/lib/site-config';
import { BookOpen, Code, GitPullRequest, Heart, Scale, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: `Open Source — ${siteConfig.name}`,
  description: 'DerList is fully open source under the MIT license. Learn how to contribute.',
};

export default function OpenSourcePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="border-b border-border py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">Open Source</Badge>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Built in public. Owned by everyone.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              DerList is fully open source under the MIT license. The entire codebase is public, auditable, and community-driven.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
                  <GithubIcon className="h-4 w-4" /> View on GitHub
                </a>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Why Open Source */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <AnimatedSection variant="fade-up">
            <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">Why Open Source?</h2>
          </AnimatedSection>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reasons.map((r, i) => (
              <AnimatedSection key={r.title} variant="fade-up" delay={80 + i * 60}>
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
                  <r.icon className="h-5 w-5 text-accent" />
                  <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{r.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="border-t border-border bg-surface/30 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Tech Stack</h2>
            <p className="mt-3 text-muted-foreground">Modern, production-ready technologies.</p>
          </AnimatedSection>
          <AnimatedSection variant="fade-up" delay={100}>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {stack.map((tech) => (
                <span key={tech} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground">
                  {tech}
                </span>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Contributing */}
      <section className="border-t border-border py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Contributing</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Contributions of all sizes are welcome — from fixing typos to building entire features.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild variant="outline">
                <a href={`${siteConfig.links.github}/issues`} target="_blank" rel="noopener noreferrer">
                  View Issues
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={`${siteConfig.links.github}/pulls`} target="_blank" rel="noopener noreferrer">
                  Pull Requests
                </a>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}

const reasons = [
  { icon: Scale, title: 'Transparency', description: 'Every line of code is public. No hidden trackers, no secret data collection.' },
  { icon: Users, title: 'Community', description: 'Anyone can contribute improvements, report bugs, or suggest features.' },
  { icon: GitPullRequest, title: 'Quality', description: 'Open code gets more eyes, more testing, and better quality over time.' },
  { icon: Heart, title: 'Trust', description: 'Users can verify exactly what the software does with their data.' },
  { icon: Code, title: 'Self-Host', description: 'Run your own instance with Docker. Full control over your deployment.' },
  { icon: BookOpen, title: 'Learning', description: 'A real production codebase that others can learn from and build upon.' },
];

const stack = [
  'Next.js 16', 'React 19', 'TypeScript', 'Prisma 7', 'PostgreSQL',
  'Tailwind CSS 4', 'Arctic (OAuth)', 'Argon2id', 'Zod', 'Docker', 'Caddy',
];
