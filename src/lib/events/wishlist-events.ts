/**
 * Wishlist Event System
 *
 * Server-side pub/sub for wishlist mutation events.
 * Used by:
 * - Assistant tools to emit events during operations
 * - SSE endpoint to stream events to connected browsers
 * - Normal wishlist mutations to keep all views synchronized
 *
 * Events are scoped per-user. A subscription only receives events
 * for wishlists owned by that user.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

export type WishlistEventType =
  | 'wishlist.item.adding'
  | 'wishlist.item.added'
  | 'wishlist.item.removing'
  | 'wishlist.item.removed'
  | 'wishlist.item.updating'
  | 'wishlist.item.updated'
  | 'wishlist.import.started'
  | 'wishlist.import.progress'
  | 'wishlist.import.completed'
  | 'wishlist.remove.started'
  | 'wishlist.remove.progress'
  | 'wishlist.remove.completed'
  | 'wishlist.operation.failed'
  | 'wishlist.cleared'
  // ── AI Identification Events ──
  | 'wishlist.identification.started'
  | 'wishlist.identification.progress'
  | 'wishlist.identification.completed'
  | 'wishlist.identification.failed'
  | 'wishlist.identification.conflict';

export interface WishlistEvent {
  type: WishlistEventType;
  userId: string;
  wishlistId?: string;
  operationId: string;
  timestamp: string;
  item?: {
    id?: string;
    title: string;
    price?: number | null;
    category?: string | null;
    priority?: number;
    status?: 'pending' | 'added' | 'removed' | 'updated' | 'failed' | 'already_exists';
  };
  progress?: {
    total: number;
    completed: number;
    current?: string;
  };
  result?: {
    total: number;
    added?: number;
    removed?: number;
    failed?: number;
    alreadyExists?: number;
  };
  error?: string;
  /** AI identification details (for identification events) */
  identification?: IdentificationEventData;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Identification Event Data
// ─────────────────────────────────────────────────────────────────────────────

export interface IdentificationEventData {
  /** Current step in the identification process */
  step: IdentificationStep;
  /** Overall identification status */
  status: IdentificationEventStatus;
  /** Product info if available */
  product?: {
    name: string | null;
    brand: string | null;
    asin: string | null;
    price: number | null;
    image: string | null;
  };
  /** Confidence score 0-100 */
  confidence?: number;
  /** AI provider used */
  provider?: string;
  /** Source of identification */
  source?: string;
  /** Duration so far in ms */
  durationMs?: number;
  /** Activity timeline events */
  activity?: IdentificationActivityItem[];
  /** Field sources map */
  fieldSources?: Record<string, string>;
  /** Conflicts detected */
  conflicts?: string[];
}

export type IdentificationStep =
  | 'url_recognized'
  | 'asin_extracted'
  | 'searching'
  | 'search_complete'
  | 'ai_identifying'
  | 'ai_complete'
  | 'verifying'
  | 'verification_complete'
  | 'image_resolving'
  | 'image_resolved'
  | 'completed'
  | 'failed'
  | 'no_ai_configured'
  | 'conflict';

export type IdentificationEventStatus =
  | 'in_progress'
  | 'success'
  | 'failed'
  | 'conflict'
  | 'no_ai_configured';

export interface IdentificationActivityItem {
  step: string;
  status: 'completed' | 'in_progress' | 'failed' | 'skipped';
  message: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscriber type
// ─────────────────────────────────────────────────────────────────────────────

type Subscriber = (event: WishlistEvent) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Event Bus (in-process pub/sub)
// ─────────────────────────────────────────────────────────────────────────────

class WishlistEventBus {
  private subscribers = new Map<string, Set<Subscriber>>();

  /**
   * Subscribe to events for a specific user.
   * Returns an unsubscribe function.
   */
  subscribe(userId: string, callback: Subscriber): () => void {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    this.subscribers.get(userId)!.add(callback);

    return () => {
      const subs = this.subscribers.get(userId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) this.subscribers.delete(userId);
      }
    };
  }

  /**
   * Emit an event to all subscribers for the given user.
   */
  emit(event: WishlistEvent): void {
    const subs = this.subscribers.get(event.userId);
    if (!subs || subs.size === 0) return;

    for (const callback of subs) {
      try {
        callback(event);
      } catch {
        // Never let a subscriber error break the event bus
      }
    }
  }

  /**
   * Get the number of active subscribers for a user.
   */
  subscriberCount(userId: string): number {
    return this.subscribers.get(userId)?.size ?? 0;
  }
}

// Singleton
export const wishlistEvents = new WishlistEventBus();

// ─────────────────────────────────────────────────────────────────────────────
// Helper to generate operation IDs
// ─────────────────────────────────────────────────────────────────────────────

let opCounter = 0;

export function generateOperationId(): string {
  opCounter++;
  return `op_${Date.now()}_${opCounter}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Identification Event Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit an identification lifecycle event.
 * These are used to update the AI activity timeline in real-time.
 *
 * SECURITY: Never trust client-supplied userId. The authenticated server
 * session determines the user.
 */
export function emitIdentificationEvent(
  userId: string,
  operationId: string,
  data: IdentificationEventData,
): void {
  const eventType = mapStepToEventType(data.step, data.status);

  wishlistEvents.emit({
    type: eventType,
    userId,
    operationId,
    timestamp: new Date().toISOString(),
    identification: data,
  });
}

/**
 * Map identification step to the appropriate event type.
 */
function mapStepToEventType(
  step: IdentificationStep,
  status: IdentificationEventStatus,
): WishlistEventType {
  if (step === 'no_ai_configured') return 'wishlist.identification.failed';
  if (step === 'conflict') return 'wishlist.identification.conflict';
  if (step === 'failed') return 'wishlist.identification.failed';
  if (step === 'completed' && status === 'success') return 'wishlist.identification.completed';
  if (status === 'failed') return 'wishlist.identification.failed';

  // In-progress steps
  if (step === 'url_recognized' || step === 'asin_extracted') {
    return 'wishlist.identification.started';
  }

  return 'wishlist.identification.progress';
}

/**
 * Build a full activity timeline from accumulated events.
 * Used by the UI to display the AI activity panel.
 */
export function buildActivityTimeline(
  operationId: string,
  input: { url?: string; asin?: string; retailer?: string },
  result: {
    success: boolean;
    confidence?: number;
    product?: { title?: string; brand?: string; asin?: string };
    aiImportStatus?: string;
    fieldSources?: Record<string, unknown>;
  },
): IdentificationActivityItem[] {
  const items: IdentificationActivityItem[] = [];
  const now = new Date().toISOString();

  // URL recognized
  if (input.url) {
    items.push({
      step: 'URL recognized',
      status: 'completed',
      message: `URL recognized: ${input.retailer ?? 'unknown retailer'}`,
      timestamp: now,
    });
  }

  // ASIN extracted
  if (input.asin) {
    items.push({
      step: 'ASIN extracted',
      status: 'completed',
      message: `Amazon ASIN found: ${input.asin}`,
      timestamp: now,
    });
  }

  // AI identification
  if (result.aiImportStatus === 'no_ai_configured') {
    items.push({
      step: 'AI identification',
      status: 'skipped',
      message: 'AI provider not configured',
      timestamp: now,
    });
  } else if (result.success) {
    items.push({
      step: 'AI identifying product',
      status: 'completed',
      message: 'Product identified',
      timestamp: now,
    });
  } else {
    items.push({
      step: 'AI identifying product',
      status: 'failed',
      message: 'Could not identify product',
      timestamp: now,
    });
  }

  // Verification
  if (result.success && result.product) {
    if (result.product.brand) {
      items.push({
        step: 'Brand verified',
        status: 'completed',
        message: `Brand verified: ${result.product.brand}`,
        timestamp: now,
      });
    }
    if (result.product.asin && input.asin) {
      items.push({
        step: 'ASIN verified',
        status: 'completed',
        message: 'ASIN verified against URL',
        timestamp: now,
      });
    }
  }

  // Confidence
  if (result.confidence != null && result.confidence > 0) {
    items.push({
      step: 'Confidence calculated',
      status: 'completed',
      message: `${result.confidence}% confidence`,
      timestamp: now,
    });
  }

  return items;
}
