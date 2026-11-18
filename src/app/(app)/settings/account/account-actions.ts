'use server';

import { redirect } from 'next/navigation';
import { requireUser, verifyPassword } from '@/lib/auth';
import { clearSessionCookie } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { deleteAccountUploads } from '@/lib/uploads/cleanup';
import type { ActionState } from '../../../(auth)/actions';

/**
 * Permanently delete the signed-in account and everything owned by it.
 *
 * Collections, items and sessions cascade from the user record. The password is
 * required again so a borrowed session cannot destroy an account, and the user
 * has to type DELETE to confirm.
 */
export async function deleteAccountAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const password = String(formData.get('password') ?? '');
  const confirmation = String(formData.get('confirmation') ?? '').trim();

  if (confirmation !== 'DELETE') {
    return { success: false, error: 'Type DELETE to confirm account deletion.' };
  }

  if (!password) {
    return { success: false, error: 'Enter your password to confirm.' };
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!account) {
    return { success: false, error: 'Account not found.' };
  }

  const passwordValid = await verifyPassword(account.passwordHash, password);
  if (!passwordValid) {
    return { success: false, error: 'Incorrect password.' };
  }

  // Remove the user's uploads from disk first — database rows cascade, but
  // files do not. Files still referenced by another account are kept.
  await deleteAccountUploads(user.id);

  await prisma.user.delete({ where: { id: user.id } });
  await clearSessionCookie();

  redirect('/');
}
