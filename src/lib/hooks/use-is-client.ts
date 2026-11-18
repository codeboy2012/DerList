import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * True after hydration on the client, false during server rendering.
 *
 * Used to defer portals to the client without calling `setState` inside an
 * effect (which triggers an extra render pass and the react-hooks lint rule).
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
