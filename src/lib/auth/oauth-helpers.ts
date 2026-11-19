/**
 * Shared OAuth callback logic.
 *
 * Handles both login and account-linking flows in a provider-agnostic way.
 */

import { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { findUserByEmail } from '@/lib/auth/identity';
import { createAccount, DuplicateAccountError } from '@/lib/auth/registration';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export interface OAuthProfile {
  provider: string;
  providerAccountId: string;
  email: string | null;
  /**
   * True only when the provider itself has verified ownership of `email`.
   * Auto-linking an existing account on an unverified email is an account
   * takeover vector, so callers must set this explicitly.
   */
  emailVerifiedByProvider?: boolean;
  name: string | null;
  avatar: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}

export type OAuthCallbackResult =
  { type: 'redirect'; url: string } | { type: 'session_created'; redirectUrl: string };

/** Create a session, set the cookie, and record the login. */
async function signIn(userId: string): Promise<string> {
  const token = await createSession({ userId });
  await setSessionCookie(token);
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
  return '/dashboard';
}

async function linkProvider(
  userId: string,
  profile: OAuthProfile,
  avatarFallback: string | null
): Promise<void> {
  await prisma.oAuthAccount.create({
    data: {
      userId,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken ?? null,
      expiresAt: profile.expiresAt ?? null,
      providerEmail: profile.email,
      providerName: profile.name,
      providerAvatar: profile.avatar,
    },
  });

  if (avatarFallback && profile.avatar) {
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: profile.avatar },
    });
  }
}

/**
 * Process an OAuth callback.
 *
 * Flow:
 * 1. If user is logged in → link the provider account
 * 2. If provider account already linked → log in as that user
 * 3. If a provider-verified email matches an existing user → link and log in
 * 4. Otherwise → create a new account, but only when the provider verified the
 *    email address. An unverified profile email never creates or links an account.
 */
export async function handleOAuthCallback(profile: OAuthProfile): Promise<string> {
  const {
    provider,
    providerAccountId,
    email,
    name,
    avatar,
    accessToken,
    refreshToken,
    expiresAt,
    emailVerifiedByProvider = false,
  } = profile;

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
      await linkProvider(currentUser.id, profile, currentUser.avatarUrl);
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

    // Keep the stored provider tokens reasonably fresh.
    await prisma.oAuthAccount.update({
      where: { id: linked.id },
      data: {
        accessToken,
        refreshToken: refreshToken ?? linked.refreshToken,
        expiresAt: expiresAt ?? linked.expiresAt,
        providerEmail: email,
        providerName: name,
        providerAvatar: avatar,
      },
    });

    return signIn(linked.user.id);
  }

  // ── Never link or create from an email the provider has not verified ──
  if (!email) {
    return '/login?error=email_missing';
  }
  if (!emailVerifiedByProvider) {
    return '/login?error=email_unverified';
  }

  // ── Existing account with the same verified email: link and sign in ──
  const userByEmail = await findUserByEmail(email);
  if (userByEmail) {
    if (userByEmail.disabled) return '/login?error=account_disabled';

    await linkProvider(userByEmail.id, profile, userByEmail.avatarUrl);

    // The matched address is the one the provider just verified.
    if (!userByEmail.emailVerified) {
      await prisma.user.update({
        where: { id: userByEmail.id },
        data: { emailVerified: true },
      });
    }

    return signIn(userByEmail.id);
  }

  // ── First-time OAuth registration ──
  try {
    const user = await createAccount({
      email,
      displayName: name,
      emailVerified: true,
    });

    await linkProvider(user.id, profile, user.avatarUrl);
    await signIn(user.id);
    return '/dashboard?welcome=1';
  } catch (error) {
    // A concurrent request may have created the account between the lookup and
    // the insert. Link the provider to that account only if its email matches.
    if (error instanceof DuplicateAccountError && error.field === 'email') {
      const racedUser = await findUserByEmail(email);
      if (racedUser && !racedUser.disabled) {
        try {
          await linkProvider(racedUser.id, profile, racedUser.avatarUrl);
          return signIn(racedUser.id);
        } catch (linkError) {
          if (
            linkError instanceof Prisma.PrismaClientKnownRequestError &&
            linkError.code === 'P2002'
          ) {
            return signIn(racedUser.id);
          }
          throw linkError;
        }
      }
    }

    console.error('[oauth] Could not create the account:', error);
    return '/login?error=oauth_registration_failed';
  }
}
