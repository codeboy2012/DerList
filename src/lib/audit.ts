import { headers } from 'next/headers';

import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Audit Action Constants
// ─────────────────────────────────────────────────────────────────────────────

export const AuditAction = {
  // Authentication
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',

  // User management
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DISABLED: 'user.disabled',
  USER_ENABLED: 'user.enabled',
  USER_DELETED: 'user.deleted',
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_PASSWORD_RESET: 'user.password_reset',
  USER_SESSIONS_REVOKED: 'user.sessions_revoked',

  // Invitations
  INVITATION_CREATED: 'invitation.created',
  INVITATION_REVOKED: 'invitation.revoked',
  INVITATION_DELETED: 'invitation.deleted',
  INVITATION_ACCEPTED: 'invitation.accepted',

  // Waitlist
  WAITLIST_APPROVED: 'waitlist.approved',
  WAITLIST_REJECTED: 'waitlist.rejected',
  WAITLIST_DELETED: 'waitlist.deleted',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LogOptions {
  /** The action being performed. */
  action: AuditActionType;
  /** The user performing the action (null for system actions). */
  actorId?: string | null;
  /** Display name of the actor (denormalized for history). */
  actorName?: string | null;
  /** Entity type being acted upon. */
  targetType?: string | null;
  /** ID of the entity being acted upon. */
  targetId?: string | null;
  /** Human-readable name/email of the target. */
  targetName?: string | null;
  /** Additional context as a serializable object. */
  metadata?: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record an audit log entry.
 *
 * Automatically captures IP address and User-Agent from the current request
 * context (via next/headers). If called outside a request context these
 * fields will be null.
 *
 * This function never throws — audit logging should not break the primary
 * operation. Errors are logged to stderr.
 */
export async function logAudit(options: LogOptions): Promise<void> {
  try {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    try {
      const headerStore = await headers();
      ipAddress =
        headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        headerStore.get('x-real-ip') ??
        null;
      userAgent = headerStore.get('user-agent') ?? null;
    } catch {
      // Outside of request context (e.g. scripts) — skip headers
    }

    await prisma.auditLog.create({
      data: {
        action: options.action,
        actorId: options.actorId ?? null,
        actorName: options.actorName ?? null,
        targetType: options.targetType ?? null,
        targetId: options.targetId ?? null,
        targetName: options.targetName ?? null,
        metadata: options.metadata ? JSON.stringify(options.metadata) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Never throw from audit logging — log to stderr and continue
    console.error('[audit] Failed to write audit log:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: human-readable action labels
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<AuditActionType, string> = {
  [AuditAction.USER_LOGIN]: 'Logged in',
  [AuditAction.USER_LOGOUT]: 'Logged out',
  [AuditAction.USER_CREATED]: 'Created user',
  [AuditAction.USER_UPDATED]: 'Updated user',
  [AuditAction.USER_DISABLED]: 'Disabled user',
  [AuditAction.USER_ENABLED]: 'Enabled user',
  [AuditAction.USER_DELETED]: 'Deleted user',
  [AuditAction.USER_ROLE_CHANGED]: 'Changed role',
  [AuditAction.USER_PASSWORD_RESET]: 'Reset password',
  [AuditAction.USER_SESSIONS_REVOKED]: 'Revoked sessions',
  [AuditAction.INVITATION_CREATED]: 'Created invitation',
  [AuditAction.INVITATION_REVOKED]: 'Revoked invitation',
  [AuditAction.INVITATION_DELETED]: 'Deleted invitation',
  [AuditAction.INVITATION_ACCEPTED]: 'Accepted invitation',
  [AuditAction.WAITLIST_APPROVED]: 'Approved waitlist entry',
  [AuditAction.WAITLIST_REJECTED]: 'Rejected waitlist entry',
  [AuditAction.WAITLIST_DELETED]: 'Deleted waitlist entry',
};

/**
 * Get a human-readable label for an audit action.
 */
export function getActionLabel(action: string): string {
  return ACTION_LABELS[action as AuditActionType] ?? action;
}
