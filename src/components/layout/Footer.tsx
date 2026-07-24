import Link from 'next/link';

import { Container } from '@/components/ui/Container';
import { GithubIcon } from '@/components/ui/brand-icons';
import { Logo } from '@/components/ui/Logo';
import { getCurrentYear } from '@/lib/format';
import { siteConfig } from '@/lib/site-config';

const footerLinks = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'Status', href: '/status' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Open Source', href: '/open-source' },
      { label: 'Security', href: '/security' },
      { label: 'GitHub', href: siteConfig.links.github, external: true },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Beta Access', href: '/#beta-access' },
    ],
  },
];

/**
 * Footer — full sitemap footer linking to every public page.
 */
export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/30">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand block */}
          <div className="md:col-span-4">
            <Logo size="sm" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {siteConfig.description} Free forever. Open source forever.
            </p>
            <div className="mt-4">
              <a
                href={siteConfig.links.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="DerList on GitHub"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground"
              >
                <GithubIcon className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Link groups */}
          {footerLinks.map((group) => (
            <div key={group.title} className="md:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {group.title}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    {'external' in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {getCurrentYear()} {siteConfig.name} &middot; MIT Licensed &middot; Free Forever
          </p>
          <p className="text-xs text-muted-foreground">
            Built with Next.js, Tailwind CSS &amp; TypeScript.
          </p>
        </div>
      </Container>
    </footer>
  );
}
