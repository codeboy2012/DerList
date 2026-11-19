'use server';

import { redirect } from 'next/navigation';
import { hashPassword } from '@/lib/auth/password';
import { createSession, invalidateAllUserSessions, setSessionCookie } from '@/lib/auth/session';
import { findEmailToken } from '@/lib/auth/tokens';
import { prisma } from '@/lib/prisma';
import { getRequestContext } from '@/lib/security/request';
import { resetPasswordSchema } from '@/lib/validations/auth';
import type { ActionState } from '../actions';

class TokenNoLongerValidError extends Error {}

/**
 * Server Action: choose a new password with a single-use reset token.
 *
 * The token is consumed and the password written in one transaction, so a
 * concurrent request cannot reuse it. Every existing session is revoked before
 * a fresh session is issued to the person who proved access to the mailbox.
 */
export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { token, password } = parsed.data;
  const record = await findEmailToken(token, 'PASSWORD_RESET');
  if (!record) {
    return {
      success: false,
      error: 'This password reset link is invalid or has expired. Request a new one.',
    };
  }

  const account = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { disabled: true },
  });
  if (!account || account.disabled) {
    return {
      success: false,
      error: 'This account cannot reset its password. Contact an administrator.',
    };
  }

  const passwordHash = await hashPassword(password);

  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.emailToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (consumed.count !== 1) throw new TokenNoLongerValidError();

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, emailVerified: true },
      });
    });
  } catch (error) {
    if (error instanceof TokenNoLongerValidError) {
      return {
        success: false,
        error: 'This password reset link is invalid or has expired. Request a new one.',
      };
    }
    console.error('[password-reset] Could not update the password:', error);
    return { success: false, error: 'Could not reset your password. Please try again.' };
  }

  await invalidateAllUserSessions(record.userId);

  const { ipAddress, userAgent } = await getRequestContext();
  const sessionToken = await createSession({
    userId: record.userId,
    ipAddress,
    userAgent,
  });
  await setSessionCookie(sessionToken);

  await prisma.user.update({
    where: { id: record.userId },
    data: { lastLoginAt: new Date() },
  });

  redirect('/dashboard');
}
