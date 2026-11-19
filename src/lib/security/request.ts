import { headers } from 'next/headers';

/** Request metadata used for sessions, audit logs and rate-limit keys. */
export interface RequestContext {
  ipAddress: string;
  userAgent?: string;
}

/**
 * Trust the first `x-forwarded-for` hop, then `x-real-ip`. This matches the
 * existing deployment assumption of a single reverse proxy in front of the app.
 */
export async function getRequestContext(): Promise<RequestContext> {
  const headerStore = await headers();
  const ipAddress =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerStore.get('x-real-ip') ||
    'unknown';

  return {
    ipAddress,
    userAgent: headerStore.get('user-agent') ?? undefined,
  };
}
