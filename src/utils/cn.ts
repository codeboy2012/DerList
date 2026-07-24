import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names with conflict resolution.
 *
 * Combines `clsx` (conditional classes) and `tailwind-merge`
 * (resolves conflicting Tailwind utilities, last one wins).
 *
 * @example
 * cn('p-2 text-sm', isActive && 'bg-blue-500', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
