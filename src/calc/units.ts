import type { ScalePrecision, WeightUnit } from '../types';

/** Grams in one ounce (U1). */
export const GRAMS_PER_OZ = 28.3495;
/** Grams in one pound (16 oz). */
export const GRAMS_PER_LB = GRAMS_PER_OZ * 16;

export type PackageUnit = 'g' | 'kg' | 'oz' | 'lb';

export function gramsToOunces(grams: number): number {
  return grams / GRAMS_PER_OZ;
}

export function ouncesToGrams(ounces: number): number {
  return ounces * GRAMS_PER_OZ;
}

/** Convert a package size entered in g, kg, oz or lb to grams (U4). Null if invalid. */
export function parsePackageSize(value: number, unit: PackageUnit): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  switch (unit) {
    case 'g':
      return value;
    case 'kg':
      return value * 1000;
    case 'oz':
      return ouncesToGrams(value);
    case 'lb':
      return value * GRAMS_PER_LB;
    default:
      return null;
  }
}

function decimalsFor(precision: number): number {
  if (!(precision > 0) || precision >= 1) return 0;
  return Math.min(6, Math.max(0, Math.ceil(-Math.log10(precision) - 1e-9)));
}

/** Round a weight to the scale precision. Display only (C4). */
export function roundToPrecision(grams: number, precision: ScalePrecision | number): number {
  if (!Number.isFinite(grams)) return 0;
  if (!(precision > 0)) return grams;
  const rounded = Math.round(grams / precision + 1e-9) * precision;
  return Number(rounded.toFixed(decimalsFor(precision)));
}

/** Weight text such as "12.35 g" or "0.436 oz", rounded to the scale precision. */
export function formatWeight(grams: number, unit: WeightUnit, precision: ScalePrecision | number): string {
  const decimals = decimalsFor(precision);
  const rounded = roundToPrecision(grams, precision);
  if (unit === 'oz') return `${gramsToOunces(rounded).toFixed(decimals + 1)} oz`;
  return `${rounded.toFixed(decimals)} g`;
}
