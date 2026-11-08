import { describe, expect, it } from 'vitest';
import { pricePerGram, vialPlan } from './display';

describe('vialPlan', () => {
  it('rounds vials up and notes the partial last vial', () => {
    const plan = vialPlan({ servings: 7, vials: 3.5, fillGramsPerVial: 10 }, 2);
    expect(plan.totalVials).toBe(4);
    expect(plan.partialServings).toBe(1);
    expect(plan.partialGrams).toBeCloseTo(5);
  });
  it('has no partial vial when every vial is full', () => {
    expect(vialPlan({ servings: 30, vials: 30, fillGramsPerVial: 3 }, 1)).toEqual({
      totalVials: 30,
      partialServings: 0,
      partialGrams: 0,
    });
    expect(vialPlan({ servings: 0, vials: 0, fillGramsPerVial: 0 }, 0).totalVials).toBe(0);
  });
});

describe('pricePerGram', () => {
  it('divides price by package size', () => {
    expect(pricePerGram({ packageGrams: 250, packagePrice: 20 })).toBeCloseTo(0.08);
    expect(pricePerGram({ packageGrams: 0, packagePrice: 20 })).toBe(0);
  });
});
