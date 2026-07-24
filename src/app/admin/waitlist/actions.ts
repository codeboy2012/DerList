'use server';

import { randomBytes } from 'crypto';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import { AuditAction, logAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Approve Waitlist Entry (creates invitation automatically)
// ─────────────────────────────────────────────────────────────────────────────

export async function approveWaitlistAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const entryId = formData.get('entryId') as string;

  const entry = await prisma.waitlist.findUnique({
    where: { id: entryId },
    select: { id: true, email: true, name: true, approvedAt: true },
  });
  if (!entry || entry.approvedAt) return;

  // Mark as approved
  await prisma.waitlist.update({
    where: { id: entryId },
    data: { approvedAt: new Date() },
  });

  // Create an invitation automatically (7-day expiry)
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.invitation.create({
    data: {
      email: entry.email,
      token,
      invitedById: actor.id,
      expiresAt,
    },
  });

  await logAudit({
    action: AuditAction.WAITLIST_APPROVED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'waitlist',
    targetId: entry.id,
    targetName: entry.email,
  });

  await logAudit({
    action: AuditAction.INVITATION_CREATED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'invitation',
    targetId: entry.id,
    targetName: entry.email,
    metadata: { source: 'waitlist_approval' },
  });

  revalidatePath('/admin/waitlist');
  revalidatePath('/admin/invitations');
  revalidatePath('/admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// Reject Waitlist Entry (soft-reject by deleting — no account created)
// ─────────────────────────────────────────────────────────────────────────────

export async function rejectWaitlistAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const entryId = formData.get('entryId') as string;

  const entry = await prisma.waitlist.findUnique({
    where: { id: entryId },
    select: { id: true, email: true },
  });
  if (!entry) return;

  await prisma.waitlist.delete({ where: { id: entryId } });

  await logAudit({
    action: AuditAction.WAITLIST_REJECTED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'waitlist',
    targetId: entry.id,
    targetName: entry.email,
  });

  revalidatePath('/admin/waitlist');
  revalidatePath('/admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Waitlist Entry
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteWaitlistAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const entryId = formData.get('entryId') as string;

  const entry = await prisma.waitlist.findUnique({
    where: { id: entryId },
    select: { id: true, email: true },
  });
  if (!entry) return;

  await prisma.waitlist.delete({ where: { id: entryId } });

  await logAudit({
    action: AuditAction.WAITLIST_DELETED,
    actorId: actor.id,
    actorName: actor.displayName,
    targetType: 'waitlist',
    targetId: entry.id,
    targetName: entry.email,
  });

  revalidatePath('/admin/waitlist');
  revalidatePath('/admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Approve
// ─────────────────────────────────────────────────────────────────────────────

export async function bulkApproveWaitlistAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const ids = formData.getAll('ids') as string[];
  if (ids.length === 0) return;

  const entries = await prisma.waitlist.findMany({
    where: { id: { in: ids }, approvedAt: null },
    select: { id: true, email: true },
  });

  for (const entry of entries) {
    await prisma.waitlist.update({
      where: { id: entry.id },
      data: { approvedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.invitation.create({
      data: {
        email: entry.email,
        token,
        invitedById: actor.id,
        expiresAt,
      },
    });

    await logAudit({
      action: AuditAction.WAITLIST_APPROVED,
      actorId: actor.id,
      actorName: actor.displayName,
      targetType: 'waitlist',
      targetId: entry.id,
      targetName: entry.email,
      metadata: { bulk: true },
    });
  }

  revalidatePath('/admin/waitlist');
  revalidatePath('/admin/invitations');
  revalidatePath('/admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Delete
// ─────────────────────────────────────────────────────────────────────────────

export async function bulkDeleteWaitlistAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const ids = formData.getAll('ids') as string[];
  if (ids.length === 0) return;

  const entries = await prisma.waitlist.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true },
  });

  await prisma.waitlist.deleteMany({ where: { id: { in: ids } } });

  for (const entry of entries) {
    await logAudit({
      action: AuditAction.WAITLIST_DELETED,
      actorId: actor.id,
      actorName: actor.displayName,
      targetType: 'waitlist',
      targetId: entry.id,
      targetName: entry.email,
      metadata: { bulk: true },
    });
  }

  revalidatePath('/admin/waitlist');
  revalidatePath('/admin');
}
