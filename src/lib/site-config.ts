/**
 * Centralised site configuration.
 *
 * Single source of truth for brand, links, and copy that
 * the application shell depends on. Components should
 * import from here instead of hard-coding strings.
 */

export const siteConfig = {
  name: 'DerList',
  shortName: 'DerList',
  description:
    'The modern, open-source universal wishlist, shopping planner and PC builder.',
  tagline: 'Free Forever. Open Source. Community Driven.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://derlist.dpdns.org',
  locale: 'en-US',
  license: 'MIT',
  copyrightHolder: 'DerList',

  /** Social / community links. Kept intentionally small and only what really exists. */
  links: {
    github: 'https://github.com/codeboy2012/DerList',
  },

  /** GitHub repository slug, derived from the URL. */
  github: {
    repoUrl: 'https://github.com/codeboy2012/DerList',
  },

  /** Primary nav. Only the items that exist as real pages are included. */
  nav: [
    { label: 'Home', href: '/' },
    { label: 'GitHub', href: 'https://github.com/codeboy2012/DerList', external: true },
  ] as const,
} as const;

export type SiteConfig = typeof siteConfig;
