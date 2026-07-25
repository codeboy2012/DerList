/**
 * Puter.js singleton for server-side usage.
 *
 * Initializes once with PUTER_AUTH_TOKEN and reuses across requests.
 * Falls back gracefully if token is not configured (AI features disabled).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { init } = require('@heyputer/puter.js/src/init.cjs');

let puterInstance: ReturnType<typeof init> | null = null;

/**
 * Get the Puter.js instance. Returns null if PUTER_AUTH_TOKEN is not set.
 */
export function getPuter(): ReturnType<typeof init> | null {
  const token = process.env.PUTER_AUTH_TOKEN;
  if (!token) return null;

  if (!puterInstance) {
    puterInstance = init(token);
  }
  return puterInstance;
}

/**
 * Check if Puter.js AI is available (token configured).
 */
export function isPuterAvailable(): boolean {
  return !!process.env.PUTER_AUTH_TOKEN;
}
