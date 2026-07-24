'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { hashPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { acceptInvitationSchema } from '@/lib/validations/auth';
import type { Prisma } from '@prisma/client';

import type { ActionState } from '../../actions';

/**
 * Server Action: Accept an invitation and create a user account.
 *
 * Validates the invitation token, checks expiry and usage, then creates
 * the user account with the provided credentials.
 */
export async function acceptInvitationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    token: formData.get('token'),
    username: formData.get('username'),
    displayName: formData.get('displayName'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const parsed = acceptInvitationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { token, username, displayName, password } = parsed.data;

  // Find the invitation
  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return {
      success: false,
      error: 'This invitation link is invalid.',
    };
  }

  // Check if already accepted
  if (invitation.acceptedAt) {
    return {
      success: false,
      error: 'This invitation has already been used.',
    };
  }

  // Check expiry
  if (invitation.expiresAt < new Date()) {
    return {
      success: false,
      error: 'This invitation has expired. Please contact an administrator for a new one.',
    };
  }

  // Check if email is already taken (someone else was created with same email)
  const existingEmail = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });

  if (existingEmail) {
    return {
      success: false,
      error: 'An account with this email already exists.',
    };
  }

  // Check if username is taken
  const existingUsername = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true },
  });

  if (existingUsername) {
    return {
      success: false,
      fieldErrors: { username: ['This username is already taken.'] },
    };
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user and mark invitation as accepted in a transaction
  const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const newUser = await tx.user.create({
      data: {
        email: invitation.email.toLowerCase().trim(),
        username: username.toLowerCase(),
        displayName,
        passwordHash,
        emailVerified: true, // Verified by accepting the invitation sent to their email
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return newUser;
  });

  // Create session and log them in
  const headerStore = await headers();
  const ipAddress =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerStore.get('x-real-ip') ??
    undefined;
  const userAgent = headerStore.get('user-agent') ?? undefined;

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

  redirect('/admin');
}
