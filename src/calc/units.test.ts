import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  formatWeight,
  gramsToOunces,
  ouncesToGrams,
  roundToPrecision,
} from './units';

describe('weight conversion', () => {
  it('uses 28.3495 g per ounce', () => {
    expect(ouncesToGrams(1)).toBeCloseTo(28.3495, 6);
    expect(gramsToOunces(28.3495)).toBeCloseTo(1, 9);
  });

  it('round-trips grams through ounces', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e6, noNaN: true }), (g) => {
        expect(ouncesToGrams(gramsToOunces(g))).toBeCloseTo(g, 6);
      }),
    );
  });
});

describe('roundToPrecision', () => {
  it('rounds to the scale precision', () => {
    expect(roundToPrecision(1.2345, 0.01)).toBe(1.23);
    expect(roundToPrecision(1.25, 0.1)).toBe(1.3);
    expect(roundToPrecision(12.5, 1)).toBe(13);
    expect(roundToPrecision(0, 0.01)).toBe(0);
  });

  it('handles bad input', () => {
    expect(roundToPrecision(NaN, 0.1)).toBe(0);
    expect(roundToPrecision(1.234, 0 as never)).toBe(1.234);
  });

  it('is idempotent and within half a step', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e5, noNaN: true }),
        fc.constantFrom(0.01, 0.1, 1),
        (g, p) => {
          const r = roundToPrecision(g, p);
          expect(roundToPrecision(r, p)).toBe(r);
          expect(Math.abs(r - g)).toBeLessThanOrEqual(p / 2 + 1e-6);
        },
      ),
    );
  });
});

describe('formatWeight', () => {
  it('formats grams and ounces to the precision', () => {
    expect(formatWeight(12.3456, 'g', 0.01)).toBe('12.35 g');
    expect(formatWeight(12.3456, 'g', 0.1)).toBe('12.3 g');
    expect(formatWeight(12.6, 'g', 1)).toBe('13 g');
    expect(formatWeight(28.3495, 'oz', 0.01)).toBe('1.000 oz');
    expect(formatWeight(56.699, 'oz', 0.1)).toBe('2.00 oz');
  });
});
