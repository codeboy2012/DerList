'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin, requireOwner } from '@/lib/auth';
import { hashPassword } from '@/lib/auth/password';
import { invalidateAllUserSessions } from '@/lib/auth/session';
import { AuditAction, logAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { createUserSchema } from '@/lib/validations/auth';

import type { ActionState } from '../../(auth)/actions';

// ─────────────────────────────────────────────────────────────────────────────
// Create User
// ─────────────────────────────────────────────────────────────────────────────

export async function createUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  const raw = {
    email: formData.get('email'),
    username: formData.get('username'),
    displayName: formData.get('displayName'),
    password: formData.get('password'),
    role: formData.get('role'),
  };

  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, username, displayName, password, role } = parsed.data;

  // Only OWNER can create ADMINs
  if (role === 'ADMIN' && actor.role !== 'OWNER') {
    return { success: false, error: 'Only the Owner can create Admin accounts.' };
  }

  // Check uniqueness
  const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  if (existingEmail) {
    return { success: false, fieldErrors: { email: ['This email is already in use.'] } };
  }

  const existingUsername = await prisma.user.findUnique({ where: { username: username.toLowerCase() }, select: { id: true } });
  if (existingUsername) {
    return { success: false, fieldErrors: { username: ['This username is already taken.'] } };
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      username: username.toLowerCase(),
      displayName,
      passwordHash,
      role,
      emailVerified: true,
    },
  });

  await logAudit({
    action: AuditAction.USER_CREATED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'user',
    targetId: user.id,
    targetName: user.email,
    metadata: { role },
  });

  revalidatePath('/admin/users');
  revalidatePath('/admin');
  redirect('/admin/users');
}

// ─────────────────────────────────────────────────────────────────────────────
// Disable User
// ─────────────────────────────────────────────────────────────────────────────

export async function disableUserAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const userId = formData.get('userId') as string;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true, disabled: true } });
  if (!target) return;

  // Cannot disable OWNER unless you are OWNER
  if (target.role === 'OWNER' && actor.role !== 'OWNER') return;
  // Cannot disable yourself
  if (target.id === actor.id) return;

  await prisma.user.update({ where: { id: userId }, data: { disabled: true } });
  await invalidateAllUserSessions(userId);

  await logAudit({
    action: AuditAction.USER_DISABLED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'user',
    targetId: target.id,
    targetName: target.email,
  });

  revalidatePath('/admin/users');
  revalidatePath('/admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// Enable User
// ─────────────────────────────────────────────────────────────────────────────

export async function enableUserAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const userId = formData.get('userId') as string;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true } });
  if (!target) return;

  if (target.role === 'OWNER' && actor.role !== 'OWNER') return;

  await prisma.user.update({ where: { id: userId }, data: { disabled: false } });

  await logAudit({
    action: AuditAction.USER_ENABLED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'user',
    targetId: target.id,
    targetName: target.email,
  });

  revalidatePath('/admin/users');
  revalidatePath('/admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete User (Owner only)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteUserAction(formData: FormData): Promise<void> {
  const actor = await requireOwner();
  const userId = formData.get('userId') as string;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
  if (!target) return;

  // Cannot delete yourself or another OWNER
  if (target.id === actor.id) return;
  if (target.role === 'OWNER') return;

  await prisma.user.delete({ where: { id: userId } });

  await logAudit({
    action: AuditAction.USER_DELETED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'user',
    targetId: target.id,
    targetName: target.email,
  });

  revalidatePath('/admin/users');
  revalidatePath('/admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// Change Role
// ─────────────────────────────────────────────────────────────────────────────

export async function changeRoleAction(formData: FormData): Promise<void> {
  const actor = await requireOwner();
  const userId = formData.get('userId') as string;
  const newRole = formData.get('role') as 'USER' | 'ADMIN';

  if (newRole !== 'USER' && newRole !== 'ADMIN') return;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
  if (!target) return;

  // Cannot change OWNER role or change your own role
  if (target.role === 'OWNER') return;
  if (target.id === actor.id) return;

  await prisma.user.update({ where: { id: userId }, data: { role: newRole } });

  await logAudit({
    action: AuditAction.USER_ROLE_CHANGED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'user',
    targetId: target.id,
    targetName: target.email,
    metadata: { from: target.role, to: newRole },
  });

  revalidatePath('/admin/users');
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset Password
// ─────────────────────────────────────────────────────────────────────────────

export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const userId = formData.get('userId') as string;
  const newPassword = formData.get('newPassword') as string;

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' };
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
  if (!target) return { success: false, error: 'User not found.' };

  // Cannot reset OWNER password unless you are OWNER
  if (target.role === 'OWNER' && actor.role !== 'OWNER') {
    return { success: false, error: 'Only the Owner can reset another Owner password.' };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await invalidateAllUserSessions(userId);

  await logAudit({
    action: AuditAction.USER_PASSWORD_RESET,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'user',
    targetId: target.id,
    targetName: target.email,
  });

  revalidatePath('/admin/users');
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Force Logout (revoke all sessions)
// ─────────────────────────────────────────────────────────────────────────────

export async function forceLogoutAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const userId = formData.get('userId') as string;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
  if (!target) return;

  if (target.role === 'OWNER' && actor.role !== 'OWNER') return;

  await invalidateAllUserSessions(userId);

  await logAudit({
    action: AuditAction.USER_SESSIONS_REVOKED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'user',
    targetId: target.id,
    targetName: target.email,
  });

  revalidatePath('/admin/users');
}
