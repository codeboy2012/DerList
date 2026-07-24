'use server';

import { randomBytes } from 'crypto';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/lib/auth';
import { AuditAction, logAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

import type { ActionState } from '../../(auth)/actions';

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const createInvitationSchema = z.object({
  email: z.string().min(1, 'Email is required.').email('Please enter a valid email.'),
  expiresInDays: z.coerce.number().min(1, 'Must be at least 1 day.').max(90, 'Must be at most 90 days.'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Create Invitation
// ─────────────────────────────────────────────────────────────────────────────

export async function createInvitationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();

  const raw = {
    email: formData.get('email'),
    expiresInDays: formData.get('expiresInDays'),
  };

  const parsed = createInvitationSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, expiresInDays } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existingUser) {
    return { success: false, fieldErrors: { email: ['A user with this email already exists.'] } };
  }

  // Check if there's already a pending invitation for this email
  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      email: normalizedEmail,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (existingInvitation) {
    return { success: false, fieldErrors: { email: ['A pending invitation already exists for this email.'] } };
  }

  // Generate cryptographically secure token
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      email: normalizedEmail,
      token,
      invitedById: actor.id,
      expiresAt,
    },
  });

  await logAudit({
    action: AuditAction.INVITATION_CREATED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'invitation',
    targetId: invitation.id,
    targetName: normalizedEmail,
    metadata: { expiresInDays },
  });

  revalidatePath('/admin/invitations');
  revalidatePath('/admin');
  redirect('/admin/invitations');
}

// ─────────────────────────────────────────────────────────────────────────────
// Revoke Invitation (mark as expired by setting expiresAt to now)
// ─────────────────────────────────────────────────────────────────────────────

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const invitationId = formData.get('invitationId') as string;

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: { id: true, email: true, acceptedAt: true },
  });
  if (!invitation || invitation.acceptedAt) return;

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { expiresAt: new Date() },
  });

  await logAudit({
    action: AuditAction.INVITATION_REVOKED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'invitation',
    targetId: invitation.id,
    targetName: invitation.email,
  });

  revalidatePath('/admin/invitations');
  revalidatePath('/admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Invitation
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteInvitationAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const invitationId = formData.get('invitationId') as string;

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: { id: true, email: true },
  });
  if (!invitation) return;

  await prisma.invitation.delete({ where: { id: invitationId } });

  await logAudit({
    action: AuditAction.INVITATION_DELETED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'invitation',
    targetId: invitation.id,
    targetName: invitation.email,
  });

  revalidatePath('/admin/invitations');
  revalidatePath('/admin');
}
