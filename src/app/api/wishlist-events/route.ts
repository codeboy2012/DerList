/**
 * GET /api/wishlist-events — Server-Sent Events endpoint for live wishlist updates.
 *
 * Streams wishlist mutation events to connected browsers.
 * Scoped to the authenticated user — only receives events for their wishlists.
 * Used by LiveWishlistPanel for real-time updates.
 */

import { getCurrentUser } from '@/lib/auth';
import { wishlistEvents, type WishlistEvent } from '@/lib/events/wishlist-events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = user.id;

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      const connectEvent = `data: ${JSON.stringify({ type: 'connected', userId, timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(connectEvent));

      // Subscribe to user's wishlist events
      const unsubscribe = wishlistEvents.subscribe(userId, (event: WishlistEvent) => {
        try {
          // Strip userId from the event sent to client (they already know who they are)
          const { userId: _uid, ...clientEvent } = event;
          const sseData = `data: ${JSON.stringify(clientEvent)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch {
          // Stream closed — will be caught by cancel
        }
      });

      // Send keepalive every 30 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepalive);
        }
      }, 30000);

      // Clean up on disconnect
      const cleanup = () => {
        unsubscribe();
        clearInterval(keepalive);
      };

      // Store cleanup for the cancel handler
      (controller as unknown as { _cleanup: () => void })._cleanup = cleanup;
    },

    cancel(controller) {
      const cleanup = (controller as unknown as { _cleanup?: () => void })?._cleanup;
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
