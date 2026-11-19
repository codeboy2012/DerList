'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { consumeEmailToken } from '@/lib/auth/tokens';
import { prisma } from '@/lib/prisma';

/**
 * Server Action: confirm an email address with a single-use token.
 *
 * Verification is a POST so link scanners that prefetch URLs cannot consume
 * the token before the recipient clicks the confirmation button.
 */
export async function verifyEmailAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const userId = await consumeEmailToken(token, 'EMAIL_VERIFICATION');

  if (!userId) {
    redirect('/verify-email?status=invalid');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true },
  });

  const user = await getCurrentUser();
  redirect(user?.id === userId ? '/settings/account?verified=1' : '/login?verified=1');
}
