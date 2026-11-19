/**
 * SSRF-safe fetch helper.
 *
 * All server-side fetches of user-supplied URLs (product pages, images) go
 * through this module. It provides defence in depth:
 *
 * 1. Structural validation of the URL (scheme, credentials, hostname, port).
 * 2. DNS resolution checks so a public hostname cannot resolve to a private IP.
 * 3. Connection pinning: the socket is opened to the address that was checked,
 *    not to a second DNS answer. This closes the DNS-rebinding / TOCTOU gap in
 *    the previous implementation, which resolved the host and then let `fetch`
 *    resolve it again.
 * 4. Manual redirect handling — every hop is validated and pinned BEFORE it is
 *    requested. Credentials and cookies are stripped on cross-origin redirects.
 * 5. Bounded response size and request time.
 */

import { lookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingMessage, type RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { Readable, Transform } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import { normalizeHostname } from './url';

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

const SENSITIVE_REDIRECT_HEADERS = ['authorization', 'cookie', 'proxy-authorization'];

const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeHost(hostname: string): string {
  return normalizeHostname(hostname);
}

interface Ipv6Words extends Array<number> {
  0: number;
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  7: number;
}

/** Parse an IPv6 address (including an embedded dotted-quad) into eight words. */
function parseIpv6(ip: string): Ipv6Words | null {
  let value = ip.toLowerCase();

  // Convert a trailing dotted-quad (::ffff:127.0.0.1) into two hex groups.
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    if (lastColon < 0) return null;
    const v4 = value.slice(lastColon + 1);
    const parts = v4.split('.').map(Number);
    if (
      parts.length !== 4 ||
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return null;
    }
    value = `${value.slice(0, lastColon + 1)}${((parts[0] << 8) | parts[1]).toString(16)}:${(
      (parts[2] << 8) |
      parts[3]
    ).toString(16)}`;
  }

  const hasCompression = value.includes('::');
  const halves = value.split('::');
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

  if (!hasCompression && head.length !== 8) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (hasCompression && missing === 0)) return null;

  const groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    return null;
  }

  return groups.map((group) => parseInt(group, 16)) as Ipv6Words;
}

function ipv4FromWords(high: number, low: number): string {
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

/**
 * Returns true when an IP address is loopback, private, link-local, multicast,
 * reserved, documentation-only, or an IPv4-mapped private address.
 */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);

  if (version === 4) {
    const octets = ip.split('.').map(Number);
    const [a, b, c] = octets;
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0) return true; // 192.0.0.0/16
    if (a === 192 && b === 88 && c === 99) return true; // 6to4 relay anycast
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  if (version === 6) {
    const words = parseIpv6(ip);
    if (!words) return true;

    if (words.every((word) => word === 0)) return true; // ::
    if (words.slice(0, 7).every((word) => word === 0) && words[7] === 1) return true; // ::1

    // IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96) addresses.
    if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
      return isPrivateIp(ipv4FromWords(words[6], words[7]));
    }
    if (words.slice(0, 6).every((word) => word === 0) && (words[6] !== 0 || words[7] !== 0)) {
      return isPrivateIp(ipv4FromWords(words[6], words[7]));
    }

    // 6to4 (2002::/16) and NAT64 (64:ff9b::/96) embed an IPv4 destination.
    if (words[0] === 0x2002) return isPrivateIp(ipv4FromWords(words[1], words[2]));
    if (
      words[0] === 0x0064 &&
      words[1] === 0xff9b &&
      words[2] === 0 &&
      words[3] === 0 &&
      words[4] === 0 &&
      words[5] === 0
    ) {
      return isPrivateIp(ipv4FromWords(words[6], words[7]));
    }

    if ((words[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
    if ((words[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((words[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local
    if ((words[0] & 0xff00) === 0xff00) return true; // multicast
    if (words[0] === 0x2001 && words[1] === 0x0db8) return true; // documentation
    if (words[0] === 0x2001 && words[1] === 0) return true; // Teredo
    if (words[0] === 0x2001 && words[1] >= 0x10 && words[1] <= 0x2f) return true; // ORCHID

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

export interface PublicAddress {
  address: string;
  family: number;
}

const defaultResolver: HostResolver = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

/**
 * Resolve a hostname and return only public addresses.
 *
 * Resolution failures are treated as unsafe (fail closed) so DNS outages cannot
 * silently bypass the check. The returned addresses are the ones the transport
 * must connect to; they must not be re-resolved later.
 */
export async function resolvePublicAddresses(
  url: URL,
  resolveHost: HostResolver = defaultResolver
): Promise<PublicAddress[]> {
  const hostname = normalizeHost(url.hostname);

  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new UnsafeUrlError('URL points to a private or internal address.');
    }
    return [{ address: hostname, family: isIP(hostname) }];
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

  return addresses;
}

/** Resolve a hostname and reject it when any resolved address is private. */
export async function assertPublicHost(
  url: URL,
  resolveHost: HostResolver = defaultResolver
): Promise<void> {
  await resolvePublicAddresses(url, resolveHost);
}

export type SafeFetchTransport = (
  url: URL,
  init: RequestInit,
  pinnedAddresses: PublicAddress[]
) => Promise<Response>;

export interface SafeFetchOptions {
  /** Maximum number of redirects to follow (default 5). */
  maxRedirects?: number;
  /** Injectable resolver for tests. */
  resolveHost?: HostResolver;
  /** Injectable HTTP transport for tests. */
  transport?: SafeFetchTransport;
  /** Maximum decompressed response body size (default 10 MiB). */
  maxResponseBytes?: number;
  /** Total time allowed for each redirect hop (default 30 seconds). */
  timeoutMs?: number;
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  const source = new Headers(headers);
  source.forEach((value, key) => {
    // Never let a caller override Host, which is derived from the validated URL.
    if (key.toLowerCase() !== 'host') result[key] = value;
  });
  return result;
}

async function serializeBody(body: RequestInit['body']): Promise<Buffer | undefined> {
  if (body == null) return undefined;
  if (typeof body === 'string') return Buffer.from(body);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString());
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return Buffer.from(await body.arrayBuffer());
  }
  throw new UnsafeUrlError('Unsupported request body type.');
}

function responseHeaders(nodeResponse: IncomingMessage): Headers {
  const headers = new Headers();
  const raw = nodeResponse.rawHeaders;
  for (let index = 0; index < raw.length; index += 2) {
    headers.append(raw[index], raw[index + 1]);
  }
  return headers;
}

function decompressedBody(nodeResponse: IncomingMessage): Readable {
  const encoding = String(nodeResponse.headers['content-encoding'] ?? '').toLowerCase();
  if (encoding === 'gzip' || encoding === 'x-gzip') return nodeResponse.pipe(createGunzip());
  if (encoding === 'deflate') return nodeResponse.pipe(createInflate());
  if (encoding === 'br') return nodeResponse.pipe(createBrotliDecompress());
  return nodeResponse;
}

function limitedBody(stream: Readable, maxBytes: number): Readable {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return stream;
  let total = 0;
  return stream.pipe(
    new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        total += chunk.length;
        if (total > maxBytes) {
          callback(new UnsafeUrlError('Response is too large.'));
          return;
        }
        callback(null, chunk);
      },
    })
  );
}

/** Default transport: Node's HTTP(S) client with a pinned DNS answer. */
async function nodeTransport(
  url: URL,
  init: RequestInit,
  pinnedAddresses: PublicAddress[],
  maxResponseBytes: number,
  timeoutMs: number
): Promise<Response> {
  const pinned = pinnedAddresses[0];
  if (!pinned) throw new UnsafeUrlError('Could not resolve the URL hostname.');

  const hostname = normalizeHost(url.hostname);
  const isHttps = url.protocol === 'https:';
  const request = isHttps ? httpsRequest : httpRequest;
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = headersToRecord(init.headers);
  headers.host = url.host;

  const body = method === 'GET' || method === 'HEAD' ? undefined : await serializeBody(init.body);
  if (body && !headers['content-length']) headers['content-length'] = String(body.length);

  const options: RequestOptions & { servername?: string } = {
    protocol: url.protocol,
    // Connect to the address that was validated. The original hostname is
    // retained in the Host header and TLS SNI so virtual hosting and
    // certificate verification still work, but DNS is never consulted again.
    hostname: pinned.address,
    port: url.port || undefined,
    path: `${url.pathname}${url.search}`,
    method,
    headers,
    ...(isHttps && !isIP(hostname) ? { servername: hostname } : {}),
  };

  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    const requestSignal = init.signal;
    if (requestSignal?.aborted) {
      reject(new UnsafeUrlError('Request aborted.'));
      return;
    }

    const req = request(options);

    const cleanup = () => {
      clearTimeout(timer);
      requestSignal?.removeEventListener('abort', onAbort);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      req.destroy();
      reject(error);
    };

    const onAbort = () => fail(new UnsafeUrlError('Request aborted.'));
    requestSignal?.addEventListener('abort', onAbort, { once: true });

    const timer = setTimeout(() => fail(new UnsafeUrlError('Request timed out.')), timeoutMs);
    timer.unref?.();

    req.once('error', (error) => fail(error instanceof Error ? error : new Error(String(error))));
    req.once('response', (nodeResponse) => {
      if (settled) {
        nodeResponse.resume();
        return;
      }
      settled = true;
      cleanup();

      const status = nodeResponse.statusCode ?? 0;
      const noBody = method === 'HEAD' || status === 204 || status === 304;
      let bodyStream: ReadableStream<Uint8Array> | null = null;

      if (!noBody) {
        const stream = limitedBody(decompressedBody(nodeResponse), maxResponseBytes);
        bodyStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
      } else {
        nodeResponse.resume();
      }

      const response = new Response(bodyStream, {
        status,
        statusText: nodeResponse.statusMessage ?? '',
        headers: responseHeaders(nodeResponse),
      });
      Object.defineProperty(response, 'url', {
        configurable: true,
        enumerable: true,
        value: url.toString(),
      });
      resolve(response);
    });

    if (body) req.write(body);
    req.end();
  });
}

function redirectRequestInit(init: RequestInit, from: URL, to: URL): RequestInit {
  if (from.origin === to.origin) return init;
  const headers = new Headers(init.headers);
  for (const name of SENSITIVE_REDIRECT_HEADERS) headers.delete(name);
  return { ...init, headers };
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
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const transport =
    options.transport ??
    ((url: URL, init: RequestInit, pinned: PublicAddress[]) =>
      nodeTransport(url, init, pinned, maxResponseBytes, timeoutMs));

  let currentUrl = assertSafeUrl(rawUrl);
  let requestInit: RequestInit = { ...init, redirect: 'manual' };

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const pinnedAddresses = await resolvePublicAddresses(currentUrl, resolveHost);
    const response = await transport(currentUrl, requestInit, pinnedAddresses);

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');

      if (response.body) {
        await response.body.cancel().catch(() => undefined);
      }

      if (!location) {
        throw new UnsafeUrlError('Redirect response is missing a Location header.');
      }

      let resolvedTarget: URL;
      try {
        resolvedTarget = new URL(location, currentUrl);
      } catch {
        throw new UnsafeUrlError('Redirect target is not a safe URL.');
      }
      const nextUrl = assertSafeUrl(resolvedTarget.toString());

      requestInit = redirectRequestInit(requestInit, currentUrl, nextUrl);
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

    // The default transport applies this while streaming; an injected test
    // transport may return a complete Response, so enforce it here too.
    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxResponseBytes) {
      throw new UnsafeUrlError('Response is too large.');
    }

    return response;
  }

  throw new UnsafeUrlError('Too many redirects.');
}
