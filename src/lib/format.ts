/**
 * Format a date for display.
 *
 * @example
 * formatDate('2025-01-15') // -> "January 15, 2025"
 */
export function formatDate(
  input: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  },
): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Format a number as a currency string.
 *
 * Defaults to USD; falls back gracefully for unknown currencies.
 */
export function formatPrice(
  value: number,
  options: Intl.NumberFormatOptions & { currency?: string } = {},
): string {
  const { currency = 'USD', ...rest } = options;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    ...rest,
  }).format(value);
}

/**
 * Returns the current calendar year.
 * Centralised so tests can mock and call-sites read as intent.
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}
