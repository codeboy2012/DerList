/**
 * Domains known to require JavaScript rendering.
 * When extraction from HTTP HTML fails, these domains will trigger browser rendering.
 */
export const JS_REQUIRED_DOMAINS: string[] = [
  // Major retailers that heavily rely on JS for pricing
  'target.com',
  'costco.com',
  'homedepot.com',
  'lowes.com',
  'nike.com',
  'adidas.com',
];

/**
 * Check if a domain is known to require browser rendering.
 */
export function requiresBrowser(domain: string | null): boolean {
  if (!domain) return false;
  const normalized = domain.toLowerCase().replace(/^www\./, '');
  return JS_REQUIRED_DOMAINS.some((d) => normalized === d || normalized.endsWith(`.${d}`));
}
