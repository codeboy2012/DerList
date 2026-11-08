/**
 * SSRF-safe fetch helper.
 *
 * All server-side fetches of user-supplied URLs (product pages, images) must go
 * through this module. It provides defence in depth:
 *
 * 1. Structural validation of the URL (scheme, credentials, hostname, port).
 * 2. DNS resolution checks so a public hostname cannot resolve to a private IP.
 * 3. Manual redirect handling — every hop is validated BEFORE it is requested.
 *
 * The previous implementation used `redirect: 'follow'`, which meant a public
 * host could redirect the server to cloud metadata or an internal service and
 * the request had already been made by the time the final URL was checked.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const BLOCKED_HOSTNAMES: RegExp[] = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^metadata\.google\.internal$/i,
  /^metadata\.goog$/i,
];

/** Only standard web ports are allowed for user-supplied URLs. */
const ALLOWED_PORTS = new Set(['', '80', '443']);

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function normalizeHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

/**
 * Returns true when an IP address is loopback, private, link-local, multicast,
 * reserved, or an IPv4-mapped private address.
 */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);

  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51) return true; // 198.51.100.0/24
    if (a === 203 && b === 0) return true; // 203.0.113.0/24
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;

    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);

    if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // fc00::/7
    if (/^fe[89ab][0-9a-f]:/.test(lower)) return true; // fe80::/10
    if (/^ff[0-9a-f]{2}:/.test(lower)) return true; // multicast
    return false;
  }

  // Not an IP address (should not be called with hostnames).
  return true;
}

/**
 * Validate a URL's structure. Throws UnsafeUrlError when the URL must not be
 * requested. This is synchronous and network-free.
 */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Invalid URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only HTTP/HTTPS URLs are supported.');
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError('URLs with embedded credentials are not allowed.');
  }

  const hostname = normalizeHost(url.hostname);
  if (!hostname) {
    throw new UnsafeUrlError('URL is missing a hostname.');
  }

  for (const pattern of BLOCKED_HOSTNAMES) {
    if (pattern.test(hostname)) {
      throw new UnsafeUrlError('URL points to a private or internal address.');
    }
  }

  if (isIP(hostname) && isPrivateIp(hostname)) {
    throw new UnsafeUrlError('URL points to a private or internal address.');
  }

  if (!ALLOWED_PORTS.has(url.port)) {
    throw new UnsafeUrlError('URL uses a non-standard port.');
  }

  return url;
}

export type HostResolver = (
  hostname: string
) => Promise<Array<{ address: string; family: number }>>;

const defaultResolver: HostResolver = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

/**
 * Resolve a hostname and reject it when any resolved address is private.
 * IP literals are checked directly. Resolution failures are treated as unsafe
 * (fail closed) so DNS outages cannot silently bypass the check.
 */
export async function assertPublicHost(
  url: URL,
  resolveHost: HostResolver = defaultResolver
): Promise<void> {
  const hostname = normalizeHost(url.hostname);

  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new UnsafeUrlError('URL points to a private or internal address.');
    }
    return;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await resolveHost(hostname);
  } catch {
    throw new UnsafeUrlError('Could not resolve the URL hostname.');
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError('Could not resolve the URL hostname.');
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new UnsafeUrlError('URL points to a private or internal address.');
    }
  }
}

export interface SafeFetchOptions {
  /** Maximum number of redirects to follow (default 5). */
  maxRedirects?: number;
  /** Injectable resolver for tests. */
  resolveHost?: HostResolver;
}

/**
 * Fetch a user-supplied URL with SSRF protection.
 *
 * Redirects are followed manually so each hop is validated before the request
 * is issued. The response returned is the final (non-redirect) response.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: SafeFetchOptions = {}
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 5;
  const resolveHost = options.resolveHost ?? defaultResolver;

  let currentUrl = assertSafeUrl(rawUrl);
  await assertPublicHost(currentUrl, resolveHost);

  let requestInit: RequestInit = { ...init, redirect: 'manual' };

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const response = await fetch(currentUrl.toString(), requestInit);

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');

      if (response.body) {
        await response.body.cancel().catch(() => undefined);
      }

      if (!location) {
        throw new UnsafeUrlError('Redirect response is missing a Location header.');
      }

      const nextUrl = assertSafeUrl(new URL(location, currentUrl).toString());
      await assertPublicHost(nextUrl, resolveHost);
      currentUrl = nextUrl;

      const method = (requestInit.method ?? 'GET').toUpperCase();
      if (
        response.status === 303 ||
        ((response.status === 301 || response.status === 302) &&
          method !== 'GET' &&
          method !== 'HEAD')
      ) {
        requestInit = { ...requestInit, method: 'GET', body: undefined };
      }

      continue;
    }

    return response;
  }

  throw new UnsafeUrlError('Too many redirects.');
}
