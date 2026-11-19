'use server';

import { findUserByEmail } from '@/lib/auth/identity';
import { buildEmailLink, issueEmailToken } from '@/lib/auth/tokens';
import { isEmailConfigured, sendPasswordResetEmail } from '@/lib/email';
import { checkPasswordResetLimits } from '@/lib/security/auth-limits';
import { getRequestContext } from '@/lib/security/request';
import { forgotPasswordSchema } from '@/lib/validations/auth';
import type { ActionState } from '../actions';

/**
 * Server Action: request a password reset link.
 *
 * The response never reveals whether the address is registered. When SMTP is
 * disabled the page does not offer this form at all.
 */
export async function requestPasswordResetAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { ipAddress } = await getRequestContext();

  const limit = checkPasswordResetLimits(ipAddress, email);
  if (!limit.allowed) {
    return {
      success: false,
      error: 'Too many reset requests. Please try again later.',
    };
  }

  if (!isEmailConfigured()) {
    return {
      success: false,
      error: 'Password reset email is not configured on this instance.',
    };
  }

  const user = await findUserByEmail(email);

  if (user && !user.disabled) {
    try {
      const token = await issueEmailToken(user.id, 'PASSWORD_RESET');
      await sendPasswordResetEmail(email, user.username, buildEmailLink('/reset-password', token));
    } catch (error) {
      // Keep the response generic so a delivery failure cannot be used to probe
      // for accounts, but make the failure visible to the operator.
      console.error('[password-reset] Could not send the reset email:', error);
    }
  }

  return { success: true };
}
