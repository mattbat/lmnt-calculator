import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calculateBatch, gramsPerServing, mixingOrder, normalizeBatchSize, resolveServings } from './batch';
import { DEFAULT_INGREDIENTS, DEFAULT_RECIPES, DEFAULT_SETTINGS } from './defaults';
import type { BatchSize, Ingredient, Recipe, Settings } from '../types';

const recipe = (id: string) => DEFAULT_RECIPES.find((r) => r.id === id)!;
const ing = (id: string) => DEFAULT_INGREDIENTS.find((i) => i.id === id)!;
const pricePerGram = (id: string) => ing(id).packagePrice / ing(id).packageGrams;
const run = (id: string, size: BatchSize, settings: Partial<Settings> = {}) =>
  calculateBatch(recipe(id), DEFAULT_INGREDIENTS, size, { ...DEFAULT_SETTINGS, ...settings });

describe('defaults', () => {
  it('has the stable ids', () => {
    expect(DEFAULT_INGREDIENTS.map((i) => i.id)).toEqual([
      'salt', 'potassium-chloride', 'magnesium-malate', 'malic-acid',
      'citric-acid', 'lemon-powder', 'watermelon-powder', 'stevia',
    ]);
    expect(DEFAULT_RECIPES.map((r) => r.id)).toEqual(['raw', 'lemon', 'watermelon']);
    expect(DEFAULT_RECIPES.every((r) => r.builtIn && r.updatedAt === 0)).toBe(true);
    expect(DEFAULT_SETTINGS.defaultServings).toBe(30);
  });

  it('every recipe line references a default ingredient', () => {
    const ids = new Set(DEFAULT_INGREDIENTS.map((i) => i.id));
    for (const r of DEFAULT_RECIPES) for (const l of r.lines) expect(ids.has(l.ingredientId)).toBe(true);
  });
});

describe('spreadsheet numbers', () => {
  it('cost per gram', () => {
    expect(pricePerGram('salt')).toBeCloseTo(0.015453, 5);
    expect(pricePerGram('potassium-chloride')).toBeCloseTo(0.07188, 5);
    expect(pricePerGram('magnesium-malate')).toBeCloseTo(0.07988, 5);
    expect(pricePerGram('malic-acid')).toBeCloseTo(0.03946, 4);
    expect(pricePerGram('citric-acid')).toBeCloseTo(0.020559, 5);
    expect(pricePerGram('lemon-powder')).toBeCloseTo(0.042183, 5);
    expect(pricePerGram('watermelon-powder')).toBeCloseTo(0.08388, 5);
    expect(pricePerGram('stevia')).toBeCloseTo(0.14101, 5);
  });

  it('grams per serving', () => {
    expect(gramsPerServing(recipe('raw'))).toBeCloseTo(3.275, 9);
    expect(gramsPerServing(recipe('lemon'))).toBeCloseTo(4.735, 9);
    expect(gramsPerServing(recipe('watermelon'))).toBeCloseTo(5.295, 9);
  });

  it('30-serving batch costs', () => {
    const size: BatchSize = { mode: 'servings', servings: 30 };
    expect(Math.abs(run('raw', size).costPerBatch - 2.92)).toBeLessThan(0.01);
    expect(Math.abs(run('lemon', size).costPerBatch - 5.05)).toBeLessThan(0.01);
    expect(Math.abs(run('watermelon', size).costPerBatch - 7.41)).toBeLessThan(0.01);
  });

  it('per-serving cost, totals and savings', () => {
    const r = run('watermelon', { mode: 'servings', servings: 30 });
    expect(r.costPerServing).toBeCloseTo(0.25, 2);
    expect(r.totalGrams).toBeCloseTo(158.85, 6);
    expect(r.gramsPerServing).toBeCloseTo(5.295, 9);
    expect(r.savingsPerServing).toBeCloseTo(1.5 - r.costPerServing, 9);
    expect(r.savingsPerBatch).toBeCloseTo(r.savingsPerServing * 30, 9);
  });

  it('minerals and daily value', () => {
    for (const id of ['raw', 'lemon', 'watermelon']) {
      const r = run(id, { mode: 'servings', servings: 30 });
      expect(r.minerals.sodium).toBeCloseTo(950, 6);
      expect(r.minerals.potassium).toBeCloseTo(201.74, 1);
      expect(r.minerals.magnesium).toBeCloseTo(60.06, 1);
      expect(r.dailyValue.sodium).toBeCloseTo((950 / 2300) * 100, 6);
      expect(r.dailyValue.potassium).toBeCloseTo((201.74 / 4700) * 100, 2);
      expect(r.dailyValue.magnesium).toBeCloseTo((60.06 / 420) * 100, 1);
    }
  });

  it('batch weights and grams per serving (one vial)', () => {
    const r = run('lemon', { mode: 'servings', servings: 30 });
    const salt = r.lines.find((l) => l.ingredientId === 'salt')!;
    expect(salt.batchGrams).toBeCloseTo(75, 9);
    expect(r.gramsPerServing).toBeCloseTo(4.735, 9);
  });
});

describe('batch sizing', () => {
  it('servings and weight modes', () => {
    expect(resolveServings({ mode: 'servings', servings: 10 }, 3)).toEqual({ servings: 10, leftoverGrams: 0 });
    const w = resolveServings({ mode: 'weight', grams: 100 }, 3.275);
    expect(w.servings).toBe(30);
    expect(w.leftoverGrams).toBeCloseTo(100 - 30 * 3.275, 9);
  });

  it('weight mode with an exact multiple leaves nothing over', () => {
    const w = resolveServings({ mode: 'weight', grams: 0.3 * 3 }, 0.3);
    expect(w.servings).toBe(3);
    expect(w.leftoverGrams).toBeCloseTo(0, 9);
  });

  it('bad input gives zero servings, never NaN', () => {
    const bad = [0, -5, NaN, Infinity];
    for (const n of bad) {
      for (const size of [
        { mode: 'servings', servings: n },
        { mode: 'weight', grams: n },
      ] as BatchSize[]) {
        const r = resolveServings(size, 3);
        expect(r.servings).toBe(0);
        expect(Number.isNaN(r.leftoverGrams)).toBe(false);
        const batch = run('lemon', size);
        expect(batch.servings).toBe(0);
        expect(batch.costPerBatch).toBe(0);
        expect(batch.lines.every((l) => l.batchGrams === 0 && !l.lowPrecision)).toBe(true);
      }
    }
    expect(resolveServings({ mode: 'weight', grams: 50 }, 0)).toEqual({ servings: 0, leftoverGrams: 50 });
    expect(resolveServings({ mode: 'bogus' } as unknown as BatchSize, 3).servings).toBe(0);
  });

  it('reads old batch sizes given in vials as servings', () => {
    expect(normalizeBatchSize({ mode: 'vials', vials: 4 })).toEqual({ mode: 'servings', servings: 4 });
    expect(normalizeBatchSize({ mode: 'vials', vials: 4 }, 3)).toEqual({ mode: 'servings', servings: 12 });
    expect(normalizeBatchSize({ mode: 'vials', vials: 4 }, 0)).toEqual({ mode: 'servings', servings: 4 });
    expect(normalizeBatchSize({ mode: 'servings', servings: 7 })).toEqual({ mode: 'servings', servings: 7 });
    expect(normalizeBatchSize({ mode: 'weight', grams: 50 })).toEqual({ mode: 'weight', grams: 50 });
    for (const bad of [undefined, null, 5, {}, { mode: 'vials' }, { mode: 'servings', servings: 'x' }, { mode: 'weight', grams: NaN }]) {
      expect(normalizeBatchSize(bad)).toBeUndefined();
    }
  });
});

describe('calculateBatch edge cases', () => {
  it('lists and skips missing ingredients', () => {
    const r = recipe('lemon');
    const withMissing: Recipe = { ...r, lines: [...r.lines, { ingredientId: 'ghost', gramsPerServing: 1 }, { ingredientId: 'ghost', gramsPerServing: 1 }] };
    const out = calculateBatch(withMissing, DEFAULT_INGREDIENTS, { mode: 'servings', servings: 30 }, DEFAULT_SETTINGS);
    expect(out.missingIngredientIds).toEqual(['ghost']);
    expect(out.lines).toHaveLength(6);
    expect(out.totalGrams).toBeCloseTo(4.735 * 30, 6);
  });

  it('flags low precision only for positive weights under 10x precision', () => {
    const one = run('watermelon', { mode: 'servings', servings: 1 }, { scalePrecision: 0.1 });
    expect(one.lines.find((l) => l.ingredientId === 'stevia')!.lowPrecision).toBe(true);
    const ten = run('watermelon', { mode: 'servings', servings: 10 }, { scalePrecision: 0.1 });
    expect(ten.lines.find((l) => l.ingredientId === 'stevia')!.lowPrecision).toBe(false); // 1.2 g >= 10 x 0.1 g
    const thirty = run('watermelon', { mode: 'servings', servings: 30 }, { scalePrecision: 0.1 });
    const stevia = thirty.lines.find((l) => l.ingredientId === 'stevia')!;
    expect(stevia.lowPrecision).toBe(false);
    expect(stevia.displayGrams).toBe(3.6);
  });

  it('savings can be negative', () => {
    const r = run('watermelon', { mode: 'servings', servings: 10 }, { retailPricePerServing: 0.1 });
    expect(r.savingsPerServing).toBeLessThan(0);
    expect(r.savingsPerBatch).toBeLessThan(0);
  });

  it('weight mode reports leftover', () => {
    const r = run('raw', { mode: 'weight', grams: 100 });
    expect(r.servings).toBe(30);
    expect(r.leftoverGrams).toBeCloseTo(1.75, 9);
  });

  it('tolerates bad ingredient data', () => {
    const odd: Ingredient[] = [
      { ...ing('salt'), packageGrams: 0 },
      ing('stevia'),
    ];
    const r: Recipe = { ...recipe('lemon'), lines: [{ ingredientId: 'salt', gramsPerServing: NaN }, { ingredientId: 'stevia', gramsPerServing: 1 }] };
    const out = calculateBatch(r, odd, { mode: 'servings', servings: 2 }, DEFAULT_SETTINGS);
    expect(out.costPerBatch).toBeGreaterThan(0);
    expect(out.lines[0]!.cost).toBe(0);
  });
});

describe('mixingOrder', () => {
  const lines = [
    { id: 'a', group: 'flavor' as const, batchGrams: 5 },
    { id: 'b', group: 'base' as const, batchGrams: 1 },
    { id: 'c', group: 'flavor' as const, batchGrams: 2 },
    { id: 'd', group: 'base' as const, batchGrams: 9 },
  ];
  it('puts base largest-first, then flavor smallest-first', () => {
    expect(mixingOrder(lines).map((l) => l.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('orders the default Watermelon recipe', () => {
    const r = run('watermelon', { mode: 'servings', servings: 30 });
    expect(mixingOrder(r.lines).map((l) => l.ingredientId)).toEqual([
      'salt', 'magnesium-malate', 'potassium-chloride', 'stevia', 'malic-acid', 'watermelon-powder',
    ]);
  });

  it('is a permutation with base before flavor', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ group: fc.constantFrom('base', 'flavor'), batchGrams: fc.integer({ min: 0, max: 20 }) }), { maxLength: 15 }),
        (arr) => {
          const items = arr.map((x, i) => ({ ...x, i }));
          const out = mixingOrder(items);
          expect([...out].sort((a, b) => a.i - b.i)).toEqual(items);
          const firstFlavor = out.findIndex((l) => l.group === 'flavor');
          if (firstFlavor >= 0) expect(out.slice(firstFlavor).every((l) => l.group === 'flavor')).toBe(true);
        },
      ),
    );
  });
});

describe('properties', () => {
  const recipeArb = fc.constantFrom(...DEFAULT_RECIPES.map((r) => r.id));
  const servingsArb = fc.integer({ min: 1, max: 500 });

  it('every line scales linearly with servings', () => {
    fc.assert(
      fc.property(recipeArb, servingsArb, fc.integer({ min: 1, max: 20 }), (id, n, k) => {
        const a = run(id, { mode: 'servings', servings: n });
        const b = run(id, { mode: 'servings', servings: n * k });
        a.lines.forEach((l, i) => {
          expect(b.lines[i]!.batchGrams).toBeCloseTo(l.batchGrams * k, 6);
          expect(b.lines[i]!.cost).toBeCloseTo(l.cost * k, 6);
        });
        expect(b.costPerBatch).toBeCloseTo(a.costPerBatch * k, 6);
        expect(b.costPerServing).toBeCloseTo(a.costPerServing, 9);
      }),
    );
  });

  it('totals equal the sum of the lines', () => {
    fc.assert(
      fc.property(recipeArb, servingsArb, fc.constantFrom(0.01, 0.1, 1), (id, n, p) => {
        const r = run(id, { mode: 'servings', servings: n }, { scalePrecision: p });
        expect(r.costPerBatch).toBeCloseTo(r.lines.reduce((s, l) => s + l.cost, 0), 9);
        expect(r.totalGrams).toBeCloseTo(r.lines.reduce((s, l) => s + l.batchGrams, 0), 9);
        expect(r.totalGrams).toBeCloseTo(gramsPerServing(recipe(id)) * n, 6);
      }),
    );
  });

  it('rounding never changes cost', () => {
    fc.assert(
      fc.property(recipeArb, servingsArb, (id, n) => {
        const size: BatchSize = { mode: 'servings', servings: n };
        const fine = run(id, size, { scalePrecision: 0.01 });
        const coarse = run(id, size, { scalePrecision: 1 });
        expect(coarse.costPerBatch).toBe(fine.costPerBatch);
        expect(coarse.costPerServing).toBe(fine.costPerServing);
        coarse.lines.forEach((l, i) => {
          expect(l.batchGrams).toBe(fine.lines[i]!.batchGrams);
          expect(l.cost).toBe(fine.lines[i]!.cost);
        });
      }),
    );
  });

  it('servings and weight modes agree', () => {
    fc.assert(
      fc.property(recipeArb, servingsArb, (id, n) => {
        const gps = gramsPerServing(recipe(id));
        const a = run(id, { mode: 'servings', servings: n });
        const c = run(id, { mode: 'weight', grams: n * gps });
        expect(c.servings).toBe(a.servings);
        expect(c.costPerBatch).toBeCloseTo(a.costPerBatch, 6);
        expect(c.totalGrams).toBeCloseTo(a.totalGrams, 6);
        expect(a.gramsPerServing).toBeCloseTo(gps, 9);
        expect(c.leftoverGrams).toBeCloseTo(0, 6);
      }),
    );
  });

  it('weight mode never uses more than the weight given', () => {
    fc.assert(
      fc.property(recipeArb, fc.double({ min: 0, max: 5000, noNaN: true }), (id, w) => {
        const r = run(id, { mode: 'weight', grams: w });
        expect(r.totalGrams + r.leftoverGrams).toBeCloseTo(w, 6);
        expect(r.leftoverGrams).toBeGreaterThanOrEqual(0);
        expect(r.leftoverGrams).toBeLessThan(gramsPerServing(recipe(id)) + 1e-6);
      }),
    );
  });
});
