/**
 * Generic runtime helpers. Pure, side-effect-free, tree-shakable.
 */

/** Resolve a value that may be a function or a static value. */
export function resolveValue<T>(value: T | (() => T)): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

/** Sleep for `ms` milliseconds. Returns a cancellable promise. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Trailing-edge debounce. Returns a stable function whose invocations
 * are coalesced; the last call within `wait` ms wins.
 */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number,
): {
  (...args: TArgs): void;
  cancel: () => void;
  flush: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;

  const debounced = (...args: TArgs) => {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
      lastArgs = null;
    }, wait);
  };

  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  debounced.flush = () => {
    if (timer !== null && lastArgs) {
      clearTimeout(timer);
      timer = null;
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  return debounced;
}

/**
 * Leading-edge throttle. Calls fire immediately, then at most once
 * per `wait` ms while invocations continue.
 */
export function throttle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number,
): {
  (...args: TArgs): void;
  cancel: () => void;
} {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;

  const throttled = (...args: TArgs) => {
    const now = Date.now();
    const elapsed = now - lastCall;
    if (elapsed >= wait) {
      lastCall = now;
      fn(...args);
    } else {
      lastArgs = args;
      if (timer === null) {
        timer = setTimeout(
          () => {
            lastCall = Date.now();
            timer = null;
            if (lastArgs) {
              fn(...lastArgs);
              lastArgs = null;
            }
          },
          wait - elapsed,
        );
      }
    }
  };

  throttled.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
    lastCall = 0;
  };

  return throttled;
}

/** Generate a short, URL-safe random id. Not cryptographically strong. */
export function uid(prefix = 'id'): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}
