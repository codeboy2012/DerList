'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { findUserByUsername } from '@/lib/auth/identity';
import { hashPassword, hasPassword, verifyPassword } from '@/lib/auth/password';
import { getSessionToken, invalidateOtherUserSessions } from '@/lib/auth/session';
import { buildEmailLink, issueEmailToken } from '@/lib/auth/tokens';
import { isEmailConfigured, sendVerificationEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { checkEmailSendLimit } from '@/lib/security/auth-limits';
import type { ActionState } from '../../(auth)/actions';

// ─────────────────────────────────────────────────────────────────────────────
// Update Profile
// ─────────────────────────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required.').max(64),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters.')
    .max(32)
    .regex(
      /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/,
      'Lowercase letters, numbers, hyphens, underscores only.'
    ),
  avatarUrl: z.string().url('Must be a valid URL.').optional().or(z.literal('')),
});

export async function updateProfileAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const raw = {
    displayName: formData.get('displayName'),
    username: formData.get('username'),
    avatarUrl: formData.get('avatarUrl'),
  };

  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { displayName, username, avatarUrl } = parsed.data;
  const normalizedUsername = username.toLowerCase();

  if (normalizedUsername !== user.username) {
    const existing = await findUserByUsername(normalizedUsername);
    if (existing && existing.id !== user.id) {
      return { success: false, fieldErrors: { username: ['This username is already taken.'] } };
    }
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName,
        username: normalizedUsername,
        avatarUrl: avatarUrl || null,
      },
    });
  } catch (error) {
    // The unique index is the final guard against a concurrent rename.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return { success: false, fieldErrors: { username: ['This username is already taken.'] } };
    }
    throw error;
  }

  revalidatePath('/settings/profile');
  revalidatePath('/dashboard');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Change or set password
// ─────────────────────────────────────────────────────────────────────────────

const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, 'New password must be at least 8 characters.').max(128),
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export async function changePasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const sessionUser = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword') ?? undefined,
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { passwordHash: true },
  });
  if (!user) return { success: false, error: 'User not found.' };

  // Accounts created through OAuth have no password yet: allow setting one
  // without a current password, since the session already proves ownership.
  if (hasPassword(user.passwordHash)) {
    if (!parsed.data.currentPassword) {
      return {
        success: false,
        fieldErrors: { currentPassword: ['Current password is required.'] },
      };
    }

    const valid = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
    if (!valid) {
      return { success: false, fieldErrors: { currentPassword: ['Incorrect password.'] } };
    }
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { passwordHash: newHash },
  });

  // Sign out every other device without terminating the current session.
  const currentToken = await getSessionToken();
  if (currentToken) {
    await invalidateOtherUserSessions(sessionUser.id, currentToken);
  }

  revalidatePath('/settings/account');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resend email verification
// ─────────────────────────────────────────────────────────────────────────────

export async function resendVerificationAction(): Promise<ActionState> {
  const user = await requireUser();

  if (user.emailVerified) {
    return { success: false, error: 'Your email address is already verified.' };
  }

  if (!isEmailConfigured()) {
    return {
      success: false,
      error: 'Email delivery is not configured on this instance.',
    };
  }

  const limit = checkEmailSendLimit(user.id);
  if (!limit.allowed) {
    return {
      success: false,
      error: 'A verification email was sent recently. Please wait before requesting another.',
    };
  }

  try {
    const token = await issueEmailToken(user.id, 'EMAIL_VERIFICATION');
    await sendVerificationEmail(user.email, user.username, buildEmailLink('/verify-email', token));
  } catch (error) {
    console.error('[verify-email] Could not send the verification email:', error);
    return {
      success: false,
      error: 'The verification email could not be sent. Please try again later.',
    };
  }

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Disconnect OAuth Account
// ─────────────────────────────────────────────────────────────────────────────

export async function disconnectOAuthAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const accountId = formData.get('accountId') as string;

  // Verify ownership
  const account = await prisma.oAuthAccount.findUnique({
    where: { id: accountId },
    select: { userId: true },
  });
  if (!account || account.userId !== user.id) return;

  await prisma.oAuthAccount.delete({ where: { id: accountId } });
  revalidatePath('/settings/account');
}
