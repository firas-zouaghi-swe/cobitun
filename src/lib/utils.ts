import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safe number formatting utilities to prevent runtime crashes
 * from calling .toFixed() / .toLocaleString() on null/undefined/NaN values.
 */

/** Safely call .toFixed() on a value that may be null/undefined/NaN/Decimal */
export function safeToFixed(value: unknown, digits: number = 2, fallback: string = '—'): string {
  const num = Number(value);
  return isNaN(num) ? fallback : num.toFixed(digits);
}

/** Safely call .toLocaleString() on a value that may be null/undefined/NaN/Decimal */
export function safeToLocaleString(value: unknown, locale?: string | string[], options?: Intl.NumberFormatOptions, fallback: string = '—'): string {
  const num = Number(value);
  return isNaN(num) ? fallback : num.toLocaleString(locale, options);
}

/** Safely format a currency value in TND */
export function formatTnd(value: unknown, digits: number = 2): string {
  return safeToLocaleString(value, undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Safely format a percentage */
export function formatPct(value: unknown, digits: number = 2): string {
  const num = Number(value);
  return isNaN(num) ? '—' : `${num.toFixed(digits)}%`;
}

/**
 * Build a customer-scoped API URL, omitting the query parameter when customerId is not provided.
 */
export function buildCustomerUrl(path: string, customerId?: number | null): string {
  return customerId ? `${path}?customerId=${customerId}` : path;
}

