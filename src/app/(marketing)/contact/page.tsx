import type { Metadata } from 'next';

import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GithubIcon } from '@/components/ui/brand-icons';
import { AnimatedSection } from '@/components/coming-soon/AnimatedSection';
import { siteConfig } from '@/lib/site-config';
import { ArrowRight, HelpCircle, Mail, MessageSquare } from 'lucide-react';

export const metadata: Metadata = {
  title: `Contact — ${siteConfig.name}`,
  description: 'Get in touch with the DerList team — support, feedback, and community.',
};

const channels = [
  {
    icon: GithubIcon,
    title: 'GitHub',
    description: 'Report bugs, request features, or browse the source code.',
    action: 'View Repository',
    href: siteConfig.links.github,
    external: true,
  },
  {
    icon: MessageSquare,
    title: 'GitHub Discussions',
    description: 'Ask questions, share ideas, or connect with the community.',
    action: 'Join Discussion',
    href: `${siteConfig.links.github}/discussions`,
    external: true,
  },
  {
    icon: HelpCircle,
    title: 'FAQ',
    description: 'Find quick answers to common questions about DerList.',
    action: 'View FAQ',
    href: '/#faq',
    external: false,
  },
];

export default function ContactPage() {
  return (
    <div className="flex flex-col">
      <section className="border-b border-border py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <AnimatedSection variant="fade-up">
            <Badge variant="secondary" className="mb-4">Contact</Badge>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Get in touch.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Have a question, found a bug, or want to contribute? Here&apos;s how to reach us.
            </p>
          </AnimatedSection>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex flex-col gap-4">
            {channels.map((channel, i) => (
              <AnimatedSection key={channel.title} variant="fade-up" delay={i * 80}>
                <a
                  href={channel.href}
                  target={channel.external ? '_blank' : undefined}
                  rel={channel.external ? 'noopener noreferrer' : undefined}
                  className="group flex items-center gap-5 rounded-2xl border border-border bg-card p-6 transition-all hover:border-border-hover hover:bg-card-hover hover-lift"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <channel.icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-foreground">{channel.title}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{channel.description}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                    {channel.action}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </a>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
