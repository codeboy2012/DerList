'use server';

import { redirect } from 'next/navigation';
import { createAccount, DuplicateAccountError } from '@/lib/auth/registration';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { buildEmailLink, issueEmailToken } from '@/lib/auth/tokens';
import { isEmailConfigured, sendVerificationEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { checkRegistrationLimits } from '@/lib/security/auth-limits';
import { getRequestContext } from '@/lib/security/request';
import { registerEmailSchema, registerUsernameSchema } from '@/lib/validations/auth';
import type { ActionState } from '../actions';

/**
 * Server Action: create a public account.
 *
 * Both registration methods create the same account shape. Username
 * registration chooses the username; email registration derives one from the
 * address. Email is always normalised and unique case-insensitively.
 *
 * No invitation, approval, allowlist or waitlist is consulted.
 */
export async function registerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Simple honeypot for automated form fills. Real users never see this field.
  if (String(formData.get('website') ?? '').trim() !== '') {
    return { success: false, error: 'Could not create your account. Please try again.' };
  }

  const method = formData.get('method') === 'email' ? 'email' : 'username';

  const raw =
    method === 'email'
      ? {
          method: 'email' as const,
          email: formData.get('email'),
          displayName: formData.get('displayName'),
          password: formData.get('password'),
          confirmPassword: formData.get('confirmPassword'),
        }
      : {
          method: 'username' as const,
          username: formData.get('username'),
          email: formData.get('email'),
          displayName: formData.get('displayName'),
          password: formData.get('password'),
          confirmPassword: formData.get('confirmPassword'),
        };

  const parsed =
    method === 'email' ? registerEmailSchema.safeParse(raw) : registerUsernameSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
  const username = 'username' in data ? data.username.trim().toLowerCase() : undefined;

  const { ipAddress, userAgent } = await getRequestContext();

  const limit = checkRegistrationLimits(ipAddress, email);
  if (!limit.allowed) {
    return {
      success: false,
      error: 'Too many registration attempts. Please try again later.',
    };
  }

  let user;
  try {
    user = await createAccount({
      email,
      username,
      displayName: data.displayName,
      password: data.password,
      emailVerified: false,
    });
  } catch (error) {
    if (error instanceof DuplicateAccountError) {
      return {
        success: false,
        fieldErrors:
          error.field === 'email'
            ? { email: ['An account with this email already exists. Sign in instead.'] }
            : { username: ['This username is already taken.'] },
      };
    }
    console.error('[register] Account creation failed:', error);
    return {
      success: false,
      error: 'Could not create your account. Please try again.',
    };
  }

  // Send a verification link only when this instance can actually deliver mail.
  let verificationSent = false;
  if (isEmailConfigured()) {
    try {
      const token = await issueEmailToken(user.id, 'EMAIL_VERIFICATION');
      await sendVerificationEmail(
        user.email,
        user.username,
        buildEmailLink('/verify-email', token)
      );
      verificationSent = true;
    } catch (error) {
      console.error('[register] Could not send the verification email:', error);
    }
  }

  const sessionToken = await createSession({
    userId: user.id,
    ipAddress,
    userAgent,
  });
  await setSessionCookie(sessionToken);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  redirect(`/dashboard?welcome=1${verificationSent ? '&verification=sent' : ''}`);
}
