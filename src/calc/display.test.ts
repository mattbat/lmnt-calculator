import { describe, expect, it } from 'vitest';
import { fillPlan, pricePerGram } from './display';

describe('fillPlan', () => {
  it('fills one vial per serving and notes a partial last vial', () => {
    const plan = fillPlan({ servings: 3.5, gramsPerServing: 10 });
    expect(plan.vials).toBe(4);
    expect(plan.partialServings).toBeCloseTo(0.5);
    expect(plan.partialGrams).toBeCloseTo(5);
  });
  it('has no partial vial when servings are whole', () => {
    expect(fillPlan({ servings: 30, gramsPerServing: 3 })).toEqual({ vials: 30, partialServings: 0, partialGrams: 0 });
    expect(fillPlan({ servings: 0, gramsPerServing: 0 }).vials).toBe(0);
    expect(fillPlan({ servings: NaN, gramsPerServing: 3 }).vials).toBe(0);
  });
});

describe('pricePerGram', () => {
  it('divides price by package size', () => {
    expect(pricePerGram({ packageGrams: 250, packagePrice: 20 })).toBeCloseTo(0.08);
    expect(pricePerGram({ packageGrams: 0, packagePrice: 20 })).toBe(0);
  });
});
