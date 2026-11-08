import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertPublicHost, assertSafeUrl, isPrivateIp, safeFetch } from '@/lib/security/safe-fetch';

const publicResolver = async () => [{ address: '93.184.216.34', family: 4 }];
const privateResolver = async () => [{ address: '127.0.0.1', family: 4 }];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isPrivateIp', () => {
  it('blocks loopback, private, link-local and reserved IPv4 ranges', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.5',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('allows public IPv4 addresses', () => {
    expect(isPrivateIp('93.184.216.34')).toBe(false);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
  });

  it('blocks IPv6 loopback, unique-local and link-local addresses', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1']) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
});

describe('assertSafeUrl', () => {
  it('rejects internal hostnames and metadata endpoints', () => {
    for (const url of [
      'http://localhost/x',
      'http://127.0.0.1/x',
      'http://169.254.169.254/latest/meta-data',
      'http://metadata.google.internal/x',
      'http://db.internal/x',
      'http://printer.local/x',
    ]) {
      expect(() => assertSafeUrl(url), url).toThrow(/private or internal/i);
    }
  });

  it('rejects non-http schemes, embedded credentials and non-web ports', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow(/HTTP\/HTTPS/i);
    expect(() => assertSafeUrl('gopher://example.com/')).toThrow(/HTTP\/HTTPS/i);
    expect(() => assertSafeUrl('https://user:pass@example.com/')).toThrow(/credentials/i);
    expect(() => assertSafeUrl('https://example.com:6379/')).toThrow(/non-standard port/i);
    expect(() => assertSafeUrl('https://example.com:8443/')).toThrow(/non-standard port/i);
  });

  it('accepts ordinary public https URLs', () => {
    expect(assertSafeUrl('https://example.com/product/1').hostname).toBe('example.com');
    expect(assertSafeUrl('http://example.com/').protocol).toBe('http:');
  });
});

describe('assertPublicHost', () => {
  it('rejects a public hostname that resolves to loopback', async () => {
    await expect(
      assertPublicHost(new URL('https://rebind.example.com/'), privateResolver)
    ).rejects.toThrow(/private or internal/i);
  });

  it('accepts a hostname that resolves to a public address', async () => {
    await expect(
      assertPublicHost(new URL('https://example.com/'), publicResolver)
    ).resolves.toBeUndefined();
  });
});

describe('safeFetch redirect handling', () => {
  it('does not request a redirect target that points at cloud metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      safeFetch('https://example.com/product', {}, { resolveHost: publicResolver })
    ).rejects.toThrow(/private or internal/i);

    // The malicious target must never be requested.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows a safe redirect and returns the final response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://cdn.example.org/image.jpg' },
        })
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await safeFetch(
      'https://example.com/image',
      {},
      { resolveHost: publicResolver }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://cdn.example.org/image.jpg');
  });

  it('refuses to follow an unbounded redirect chain', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://example.com/again' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      safeFetch('https://example.com/', {}, { resolveHost: publicResolver, maxRedirects: 3 })
    ).rejects.toThrow(/too many redirects/i);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
