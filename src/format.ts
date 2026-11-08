import { gramsToOunces } from './calc';
import type { WeightUnit } from './types';

export function money(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

export function mg(amount: number): string {
  return `${Math.round(amount)} mg`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Parses typed input ("12.5", "12,5"); undefined for blank or invalid text. */
export function parseNum(text: string): number | undefined {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** Per-serving weights need more places than the scale shows: "0.385 g". */
export function perServing(grams: number, unit: WeightUnit): string {
  if (unit === 'oz') return `${gramsToOunces(grams).toFixed(4)} oz`;
  return `${Number(grams.toFixed(3))} g`;
}

/** A number for an input box, without trailing zeros. */
export function plain(n: number, places = 4): string {
  return String(Number(n.toFixed(places)));
}
