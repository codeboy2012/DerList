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
  | 'wishlist.cleared';

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
