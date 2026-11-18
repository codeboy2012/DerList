/**
 * Fixed condition vocabulary for wishlist items.
 *
 * Kept as a small shared constant (not a database enum) so the set can grow
 * without a migration. An empty value means the condition is genuinely unknown —
 * DerList never infers or fabricates it.
 */
export const ITEM_CONDITIONS = [
  'New',
  'Used — Like New',
  'Used — Good',
  'Used — Fair',
  'Refurbished',
  'For parts',
] as const;

export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export function isItemCondition(value: unknown): value is ItemCondition {
  return typeof value === 'string' && (ITEM_CONDITIONS as readonly string[]).includes(value);
}
