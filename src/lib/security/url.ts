/**
 * Structured URL and hostname helpers.
 *
 * These are deliberately small and dependency-free so they can be shared by
 * server-side fetchers, parsers and client components. Callers must never use
 * substring checks (for example `url.includes('amazon.com')`) to decide which
 * site a URL belongs to: `amazon.com.attacker.example` contains that text but
 * is a completely different origin.
 */

/** Lowercase a WHATWG-URL hostname and remove IPv6 brackets / a trailing dot. */
export function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

/**
 * True when `hostname` is exactly `domain` or a subdomain of it.
 *
 * The leading dot in the suffix check is essential: it prevents
 * `notexample.com` from matching `example.com`, and `example.com.evil.test`
 * from matching `example.com`.
 */
export function isHostnameForDomain(hostname: string | null | undefined, domain: string): boolean {
  if (!hostname || !domain) return false;
  const host = normalizeHostname(hostname);
  const base = normalizeHostname(domain);
  if (!host || !base) return false;
  return host === base || host.endsWith(`.${base}`);
}

/** Parse an absolute HTTP(S) URL without credentials. */
export function parseHttpUrl(value: string | null | undefined): URL | null {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

/** Normalise a protocol-relative URL (`//host/path`) before parsing. */
export function normalizeProtocolRelativeUrl(value: string): string {
  return value.startsWith('//') ? `https:${value}` : value;
}

/** Return the normalised hostname for a valid HTTP(S) URL, otherwise null. */
export function getHttpHostname(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const parsed = parseHttpUrl(normalizeProtocolRelativeUrl(value.trim()));
  return parsed ? normalizeHostname(parsed.hostname) : null;
}

/** True when a URL is an HTTP(S) URL on `domain` or one of its subdomains. */
export function isUrlOnDomain(value: string | null | undefined, domain: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const parsed = parseHttpUrl(normalizeProtocolRelativeUrl(value.trim()));
  if (!parsed) return false;
  return isHostnameForDomain(parsed.hostname, domain);
}

/**
 * Return a safe image source for rendering, or null.
 *
 * Only absolute HTTP(S) URLs and same-origin root-relative paths are allowed.
 * This blocks `javascript:`, `data:`, `blob:` and other schemes that must never
 * be placed in an `<img src>` attribute.
 */
export function toSafeImageSrc(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Same-origin uploads and other root-relative paths. Protocol-relative URLs
  // are parsed below so their host and scheme are validated explicitly.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  const parsed = parseHttpUrl(normalizeProtocolRelativeUrl(trimmed));
  return parsed ? parsed.toString() : null;
}

/**
 * Google's encrypted image-search thumbnails are low quality and frequently
 * the wrong product. Match the complete hostname, not a substring of the URL.
 */
export function isGoogleEncryptedThumbnailHost(hostname: string): boolean {
  return /^encrypted-tbn\d*\.gstatic\.com$/.test(normalizeHostname(hostname));
}
