/**
 * Shared OAuth callback logic.
 *
 * Handles both login and account-linking flows in a provider-agnostic way.
 */

import { getCurrentUser } from '@/lib/auth';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export interface OAuthProfile {
  provider: string;
  providerAccountId: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}

export type OAuthCallbackResult =
  | { type: 'redirect'; url: string }
  | { type: 'session_created'; redirectUrl: string };

/**
 * Process an OAuth callback.
 *
 * Flow:
 * 1. If user is logged in → link the provider account
 * 2. If provider account already linked → log in as that user
 * 3. If email matches an existing user → auto-link and log in
 * 4. Otherwise → reject (invite-only, cannot auto-create accounts)
 */
export async function handleOAuthCallback(profile: OAuthProfile): Promise<string> {
  const { provider, providerAccountId, email, name, avatar, accessToken, refreshToken, expiresAt } = profile;

  // ── Check if user is already logged in (account linking) ──
  const currentUser = await getCurrentUser();
  if (currentUser) {
    const existing = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
    });

    if (existing && existing.userId !== currentUser.id) {
      return '/settings/account?error=oauth_already_linked_other';
    }

    if (!existing) {
      await prisma.oAuthAccount.create({
        data: {
          userId: currentUser.id,
          provider,
          providerAccountId,
          accessToken,
          refreshToken: refreshToken ?? null,
          expiresAt: expiresAt ?? null,
          providerEmail: email,
          providerName: name,
          providerAvatar: avatar,
        },
      });

      // Import avatar if user doesn't have one
      if (!currentUser.avatarUrl && avatar) {
        await prisma.user.update({
          where: { id: currentUser.id },
          data: { avatarUrl: avatar },
        });
      }
    }

    return '/settings/account?success=provider_linked';
  }

  // ── Login flow: check if provider account already linked ──
  const linked = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: { select: { id: true, disabled: true } } },
  });

  if (linked) {
    if (linked.user.disabled) return '/login?error=account_disabled';

    const token = await createSession({ userId: linked.user.id });
    await setSessionCookie(token);
    await prisma.user.update({
      where: { id: linked.user.id },
      data: { lastLoginAt: new Date() },
    });
    return '/dashboard';
  }

  // ── Check if email matches existing user (auto-link on first OAuth login) ──
  if (email) {
    const userByEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, disabled: true, avatarUrl: true },
    });

    if (userByEmail) {
      if (userByEmail.disabled) return '/login?error=account_disabled';

      // Auto-link
      await prisma.oAuthAccount.create({
        data: {
          userId: userByEmail.id,
          provider,
          providerAccountId,
          accessToken,
          refreshToken: refreshToken ?? null,
          expiresAt: expiresAt ?? null,
          providerEmail: email,
          providerName: name,
          providerAvatar: avatar,
        },
      });

      if (!userByEmail.avatarUrl && avatar) {
        await prisma.user.update({
          where: { id: userByEmail.id },
          data: { avatarUrl: avatar },
        });
      }

      const token = await createSession({ userId: userByEmail.id });
      await setSessionCookie(token);
      await prisma.user.update({
        where: { id: userByEmail.id },
        data: { lastLoginAt: new Date() },
      });
      return '/dashboard';
    }
  }

  // ── No account found — invite-only, cannot auto-create ──
  return '/login?error=no_account';
}
