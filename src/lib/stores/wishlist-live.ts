/**
 * Live Wishlist Store
 *
 * Client-side state management for the live wishlist panel.
 * Connects to SSE endpoint and processes real-time events.
 *
 * Responsibilities:
 * - Manage SSE connection lifecycle (connect, reconnect, keepalive)
 * - Process wishlist events and update local state
 * - Track active AI operations and progress
 * - Provide React hook for components
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WishlistItem {
  id: string;
  title: string;
  brand?: string | null;
  retailer?: string | null;
  price?: number | null;
  currency?: string;
  category?: string | null;
  url?: string | null;
  notes?: string | null;
  priority?: number;
  purchased?: boolean;
  /** Transient visual state during AI operations */
  _liveStatus?: 'adding' | 'removing' | 'updating' | 'added' | 'removed' | 'failed';
}

export interface ActiveOperation {
  id: string;
  type: 'import' | 'remove' | 'update' | 'clear';
  total: number;
  completed: number;
  current?: string;
  startedAt: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface LiveWishlistState {
  items: WishlistItem[];
  loading: boolean;
  connectionStatus: ConnectionStatus;
  activeOperation: ActiveOperation | null;
  totalValue: number;
  itemCount: number;
}

interface SSEEvent {
  type: string;
  operationId?: string;
  timestamp?: string;
  item?: {
    id?: string;
    title: string;
    price?: number | null;
    category?: string | null;
    priority?: number;
    status?: string;
  };
  progress?: { total: number; completed: number; current?: string };
  result?: { total: number; added?: number; removed?: number; failed?: number; alreadyExists?: number };
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useLiveWishlist() {
  const [state, setState] = useState<LiveWishlistState>({
    items: [],
    loading: true,
    connectionStatus: 'connecting',
    activeOperation: null,
    totalValue: 0,
    itemCount: 0,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch initial wishlist data
  const fetchWishlist = useCallback(async () => {
    try {
      const res = await fetch('/api/wishlists/live');
      if (!res.ok) return;
      const data = await res.json();
      if (data.items) {
        const items: WishlistItem[] = data.items;
        setState((prev) => ({
          ...prev,
          items,
          loading: false,
          itemCount: items.length,
          totalValue: items.reduce((sum, i) => sum + (i.price ?? 0), 0),
        }));
      }
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  // Process incoming SSE events
  const handleEvent = useCallback((event: SSEEvent) => {
    setState((prev) => {
      const next = { ...prev };

      switch (event.type) {
        case 'connected':
          next.connectionStatus = 'connected';
          break;

        case 'wishlist.import.started':
        case 'wishlist.remove.started':
          next.activeOperation = {
            id: event.operationId ?? '',
            type: event.type.includes('import') ? 'import' : 'remove',
            total: event.progress?.total ?? 0,
            completed: 0,
            startedAt: event.timestamp ?? new Date().toISOString(),
          };
          break;

        case 'wishlist.item.added': {
          const newItem: WishlistItem = {
            id: event.item?.id ?? `pending-${Date.now()}`,
            title: event.item?.title ?? '',
            price: event.item?.price,
            category: event.item?.category,
            priority: event.item?.priority,
            _liveStatus: 'added',
          };
          // Only add if not already present
          if (!prev.items.some((i) => i.id === newItem.id)) {
            next.items = [...prev.items, newItem];
          }
          if (next.activeOperation) {
            next.activeOperation = { ...next.activeOperation, completed: event.progress?.completed ?? next.activeOperation.completed + 1, current: event.item?.title };
          }
          break;
        }

        case 'wishlist.item.removed': {
          next.items = prev.items.filter((i) => i.id !== event.item?.id);
          if (next.activeOperation) {
            next.activeOperation = { ...next.activeOperation, completed: event.progress?.completed ?? next.activeOperation.completed + 1, current: event.item?.title };
          }
          break;
        }

        case 'wishlist.item.updated': {
          next.items = prev.items.map((i) => {
            if (i.id === event.item?.id) {
              return { ...i, title: event.item.title ?? i.title, price: event.item.price ?? i.price, category: event.item.category ?? i.category, priority: event.item.priority ?? i.priority, _liveStatus: 'adding' as const };
            }
            return i;
          });
          break;
        }

        case 'wishlist.import.progress':
          if (next.activeOperation && event.item?.status === 'already_exists') {
            next.activeOperation = { ...next.activeOperation, completed: event.progress?.completed ?? next.activeOperation.completed + 1, current: event.item?.title };
          }
          break;

        case 'wishlist.import.completed':
        case 'wishlist.remove.completed':
          next.activeOperation = null;
          break;

        case 'wishlist.cleared':
          next.items = [];
          next.activeOperation = null;
          break;

        case 'wishlist.operation.failed':
          next.activeOperation = null;
          break;
      }

      // Recalculate derived values
      next.itemCount = next.items.length;
      next.totalValue = next.items.reduce((sum, i) => sum + (i.price ?? 0), 0);

      return next;
    });

    // Clear _liveStatus after animation
    if (event.type === 'wishlist.item.added' && event.item?.id) {
      const itemId = event.item.id;
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          items: prev.items.map((i) => (i.id === itemId ? { ...i, _liveStatus: undefined } : i)),
        }));
      }, 2000);
    }
  }, []);

  // SSE connection management
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/wishlist-events');
    eventSourceRef.current = es;

    es.onmessage = (msg) => {
      try {
        const event: SSEEvent = JSON.parse(msg.data);
        handleEvent(event);
      } catch {
        // Ignore unparseable events
      }
    };

    es.onerror = () => {
      setState((prev) => ({ ...prev, connectionStatus: 'reconnecting' }));
      es.close();
      eventSourceRef.current = null;

      // Reconnect after 3 seconds
      reconnectTimerRef.current = setTimeout(() => {
        connect();
        // Re-fetch full state after reconnect
        fetchWishlist();
      }, 3000);
    };
  }, [handleEvent, fetchWishlist]);

  // Initialize
  useEffect(() => {
    fetchWishlist();
    connect();

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [fetchWishlist, connect]);

  // Manual refresh
  const refresh = useCallback(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  return { ...state, refresh };
}
