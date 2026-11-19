import { describe, expect, it, vi } from 'vitest';
import {
  assertPublicHost,
  assertSafeUrl,
  isPrivateIp,
  resolvePublicAddresses,
  safeFetch,
  type SafeFetchTransport,
} from '@/lib/security/safe-fetch';

const publicResolver = async () => [{ address: '93.184.216.34', family: 4 }];
const privateResolver = async () => [{ address: '127.0.0.1', family: 4 }];

describe('isPrivateIp', () => {
  it('blocks loopback, private, link-local, CGNAT and reserved IPv4 ranges', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.5',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '192.0.2.1',
      '198.51.100.7',
      '203.0.113.9',
      '224.0.0.1',
      '255.255.255.255',
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('allows public IPv4 addresses', () => {
    expect(isPrivateIp('93.184.216.34')).toBe(false);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
  });

  it('blocks IPv6 loopback, unique-local, link-local, mapped and reserved addresses', () => {
    for (const ip of [
      '::1',
      '::',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      'fec0::1',
      'ff02::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:192.168.1.1',
      '::ffff:c0a8:101',
      '2002:7f00:1::',
      '64:ff9b::7f00:1',
      '2001:db8::1',
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('allows public IPv6 addresses', () => {
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false);
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
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
      'http://[::1]/x',
      'http://[::ffff:127.0.0.1]/x',
      'http://2130706433/x',
      'http://0x7f000001/x',
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

  it('rejects a hostname when any resolved address is private', async () => {
    const mixedResolver = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.4', family: 4 },
    ];
    await expect(
      assertPublicHost(new URL('https://mixed.example.com/'), mixedResolver)
    ).rejects.toThrow(/private or internal/i);
  });

  it('pins the address that was validated', async () => {
    const addresses = await resolvePublicAddresses(new URL('https://example.com/'), publicResolver);
    expect(addresses).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });
});

describe('safeFetch redirect handling', () => {
  it('does not request a redirect target that points at cloud metadata', async () => {
    const transport = vi.fn<SafeFetchTransport>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
      })
    );

    await expect(
      safeFetch('https://example.com/product', {}, { resolveHost: publicResolver, transport })
    ).rejects.toThrow(/private or internal/i);

    // The malicious target must never be requested.
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('follows a safe redirect and returns the final response', async () => {
    const transport = vi
      .fn<SafeFetchTransport>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://cdn.example.org/image.jpg' },
        })
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await expect(
      safeFetch('https://example.com/image', {}, { resolveHost: publicResolver, transport })
    ).resolves.toMatchObject({ status: 200 });

    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1][0].toString()).toBe('https://cdn.example.org/image.jpg');
  });

  it('passes the pre-validated address to the transport', async () => {
    const transport = vi
      .fn<SafeFetchTransport>()
      .mockResolvedValue(new Response('ok', { status: 200 }));

    await safeFetch('https://example.com/', {}, { resolveHost: publicResolver, transport });

    expect(transport).toHaveBeenCalledWith(expect.any(URL), expect.any(Object), [
      { address: '93.184.216.34', family: 4 },
    ]);
  });

  it('strips credentials and cookies across origins but keeps them on the same origin', async () => {
    const headers = {
      authorization: 'Bearer secret',
      cookie: 'session=secret',
      'x-trace': 'keep',
    };
    const crossOrigin = vi
      .fn<SafeFetchTransport>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://cdn.example.org/image.jpg' },
        })
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    await safeFetch(
      'https://example.com/image',
      { headers },
      { resolveHost: publicResolver, transport: crossOrigin }
    );

    const redirectedHeaders = new Headers(crossOrigin.mock.calls[1][1].headers);
    expect(redirectedHeaders.get('authorization')).toBeNull();
    expect(redirectedHeaders.get('cookie')).toBeNull();
    expect(redirectedHeaders.get('x-trace')).toBe('keep');

    const sameOrigin = vi
      .fn<SafeFetchTransport>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: '/next' },
        })
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    await safeFetch(
      'https://example.com/image',
      { headers },
      { resolveHost: publicResolver, transport: sameOrigin }
    );

    const sameOriginHeaders = new Headers(sameOrigin.mock.calls[1][1].headers);
    expect(sameOriginHeaders.get('authorization')).toBe('Bearer secret');
    expect(sameOriginHeaders.get('cookie')).toBe('session=secret');
  });

  it('refuses to follow an unbounded redirect chain', async () => {
    const transport = vi.fn<SafeFetchTransport>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://example.com/again' },
      })
    );

    await expect(
      safeFetch(
        'https://example.com/',
        {},
        { resolveHost: publicResolver, transport, maxRedirects: 3 }
      )
    ).rejects.toThrow(/too many redirects/i);
    expect(transport).toHaveBeenCalledTimes(4);
  });

  it('rejects an oversized response before reading it', async () => {
    const transport = vi.fn<SafeFetchTransport>().mockResolvedValue(
      new Response('small', {
        status: 200,
        headers: { 'content-length': String(2 * 1024 * 1024) },
      })
    );

    await expect(
      safeFetch(
        'https://example.com/',
        {},
        {
          resolveHost: publicResolver,
          transport,
          maxResponseBytes: 1024 * 1024,
        }
      )
    ).rejects.toThrow(/too large/i);
  });
});
