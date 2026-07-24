import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';

/**
 * Route protection proxy (formerly middleware in older Next.js versions).
 *
 * This runs on the edge before every matched route. It performs a lightweight
 * cookie-presence check — the actual session validation (DB lookup, expiry,
 * user disabled check) happens in the Server Component via `requireUser()`
 * or `requireAdmin()`.
 *
 * This two-layer approach means:
 * 1. Proxy: fast redirect for obviously-unauthenticated requests (no cookie)
 * 2. Server Component: full validation with DB access for authenticated requests
 *
 * We cannot do full DB validation here because Prisma doesn't run on the Edge.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for session cookie presence
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const hasSession = !!sessionCookie?.value;

  // ── Redirect authenticated users from public pages to dashboard ──
  if (pathname === '/' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ── Protected admin routes ──
  if (pathname.startsWith('/admin')) {
    if (!hasSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Protected user routes (dashboard + wishlists + settings + products) ──
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/wishlists') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/products')
  ) {
    if (!hasSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Redirect authenticated users away from login ──
  if (pathname === '/login' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/dashboard/:path*',
    '/wishlists/:path*',
    '/settings/:path*',
    '/products/:path*',
    '/login',
  ],
};
