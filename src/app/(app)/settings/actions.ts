'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';
import { testProviderConfig } from '@/lib/ai/providers';
import { z } from 'zod';

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
    .regex(/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/, 'Lowercase letters, numbers, hyphens, underscores only.'),
  avatarUrl: z.string().url('Must be a valid URL.').optional().or(z.literal('')),
});

export async function updateProfileAction(
  _prevState: ActionState,
  formData: FormData,
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

  // Check username uniqueness (if changed)
  if (username !== user.username) {
    const existing = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (existing && existing.id !== user.id) {
      return { success: false, fieldErrors: { username: ['This username is already taken.'] } };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName,
      username: username.toLowerCase(),
      avatarUrl: avatarUrl || null,
    },
  });

  revalidatePath('/settings/profile');
  revalidatePath('/dashboard');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Change Password
// ─────────────────────────────────────────────────────────────────────────────

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.').max(128),
  confirmPassword: z.string().min(1, 'Please confirm your new password.'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

export async function changePasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessionUser = await requireUser();

  const raw = {
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { passwordHash: true },
  });
  if (!user) return { success: false, error: 'User not found.' };

  const valid = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
  if (!valid) {
    return { success: false, fieldErrors: { currentPassword: ['Incorrect password.'] } };
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { passwordHash: newHash },
  });

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
// ─────────────────────────────────────────────────────────────────────────────
// AI Provider Settings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update user's AI provider configuration
 */
export async function updateUserAIProvider(
  userId: string,
  providerId: string,
  config: Record<string, unknown>,
): Promise<void> {
  const user = await requireUser();
  
  // Verify the user is updating their own settings
  if (user.id !== userId) {
    throw new Error('Unauthorized');
  }

  // Update the user's AI provider settings
  await prisma.user.update({
    where: { id: userId },
    data: {
      aiProviderId: providerId,
      aiProviderConfig: config as any, // JSON field accepts any serializable value
    },
  });

  // Revalidate the settings page
  revalidatePath('/settings/ai');
}

/**
 * Test an AI provider configuration
 */
export async function testAIProviderConfig(
  providerId: string,
  config: Record<string, unknown>,
): Promise<{ available: boolean; error?: string }> {
  // This doesn't require authentication since it's just testing configuration
  try {
    return await testProviderConfig(providerId, config);
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Configuration test failed',
    };
  }
}