import type { BatchSize, Ingredient, IngredientGroup, Mineral, Recipe, Settings } from '../types';
import { roundToPrecision } from './units';

/** FDA daily values for adults, in mg. */
export const DAILY_VALUE_MG = { sodium: 2300, potassium: 4700, magnesium: 420 } as const;

export interface BatchLine {
  ingredientId: string;
  name: string;
  group: IngredientGroup;
  gramsPerServing: number;
  /** Unrounded grams for the whole batch. */
  batchGrams: number;
  /** batchGrams rounded to the scale precision, for display only (C4). */
  displayGrams: number;
  cost: number;
  /** True when the batch weight is under 10× the scale precision, where rounding can be off by more than 5% (C7). */
  lowPrecision: boolean;
}

export interface BatchResult {
  servings: number;
  /** Grams of mix in one serving (one vial). */
  gramsPerServing: number;
  totalGrams: number;
  lines: BatchLine[];
  costPerBatch: number;
  costPerServing: number;
  savingsPerServing: number;
  savingsPerBatch: number;
  /** mg per serving. */
  minerals: Record<Mineral, number>;
  /** Percent of daily value per serving. */
  dailyValue: Record<Mineral, number>;
  leftoverGrams: number;
  missingIngredientIds: string[];
}

function safe(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function gramsPerServing(recipe: Pick<Recipe, 'lines'>): number {
  return recipe.lines.reduce((sum, l) => sum + safe(l.gramsPerServing), 0);
}

export function resolveServings(
  size: BatchSize,
  gramsPerServingValue: number,
): { servings: number; leftoverGrams: number } {
  const gps = safe(gramsPerServingValue);
  switch (size.mode) {
    case 'servings':
      return { servings: safe(size.servings), leftoverGrams: 0 };
    case 'weight': {
      const grams = safe(size.grams);
      if (gps === 0) return { servings: 0, leftoverGrams: grams };
      const servings = Math.floor(grams / gps + 1e-9);
      return { servings, leftoverGrams: Math.max(0, grams - servings * gps) };
    }
    default:
      return { servings: 0, leftoverGrams: 0 };
  }
}

/**
 * Reads a saved batch size, including old ones sized by vials (dropped
 * 2026-11-09: a vial is always one serving). Returns undefined when unreadable.
 */
export function normalizeBatchSize(size: unknown, servingsPerVial = 1): BatchSize | undefined {
  if (typeof size !== 'object' || size === null) return undefined;
  const s = size as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  if (s.mode === 'servings' && num(s.servings) !== undefined) return { mode: 'servings', servings: s.servings as number };
  if (s.mode === 'weight' && num(s.grams) !== undefined) return { mode: 'weight', grams: s.grams as number };
  const vials = num(s.vials);
  if (s.mode === 'vials' && vials !== undefined) {
    const spv = num(servingsPerVial) !== undefined && servingsPerVial > 0 ? servingsPerVial : 1;
    return { mode: 'servings', servings: vials * spv };
  }
  return undefined;
}

export function calculateBatch(
  recipe: Recipe,
  ingredients: Ingredient[],
  size: BatchSize,
  settings: Settings,
): BatchResult {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const missingIngredientIds: string[] = [];
  const found: { ingredient: Ingredient; gps: number }[] = [];
  for (const line of recipe.lines) {
    const ingredient = byId.get(line.ingredientId);
    if (!ingredient) {
      if (!missingIngredientIds.includes(line.ingredientId)) missingIngredientIds.push(line.ingredientId);
      continue;
    }
    found.push({ ingredient, gps: safe(line.gramsPerServing) });
  }

  const gps = found.reduce((s, f) => s + f.gps, 0);
  const { servings, leftoverGrams } = resolveServings(size, gps);
  const precision = settings.scalePrecision;

  let costPerServing = 0;
  const minerals: Record<Mineral, number> = { sodium: 0, potassium: 0, magnesium: 0 };
  const lines: BatchLine[] = found.map(({ ingredient, gps: lineGps }) => {
    const pricePerGram =
      safe(ingredient.packageGrams) > 0 ? safe(ingredient.packagePrice) / ingredient.packageGrams : 0;
    const batchGrams = lineGps * servings;
    costPerServing += lineGps * pricePerGram;
    for (const m of ['sodium', 'potassium', 'magnesium'] as const) {
      minerals[m] += lineGps * safe(ingredient.minerals[m] ?? 0) * 1000;
    }
    return {
      ingredientId: ingredient.id,
      name: ingredient.name,
      group: ingredient.group,
      gramsPerServing: lineGps,
      batchGrams,
      displayGrams: roundToPrecision(batchGrams, precision),
      cost: batchGrams * pricePerGram,
      lowPrecision: batchGrams > 0 && batchGrams < 10 * precision,
    };
  });

  const costPerBatch = lines.reduce((s, l) => s + l.cost, 0);
  const retail = safe(settings.retailPricePerServing);
  const savingsPerServing = retail - costPerServing;

  return {
    servings,
    gramsPerServing: gps,
    totalGrams: lines.reduce((s, l) => s + l.batchGrams, 0),
    lines,
    costPerBatch,
    costPerServing,
    savingsPerServing,
    savingsPerBatch: savingsPerServing * servings,
    minerals,
    dailyValue: {
      sodium: (minerals.sodium / DAILY_VALUE_MG.sodium) * 100,
      potassium: (minerals.potassium / DAILY_VALUE_MG.potassium) * 100,
      magnesium: (minerals.magnesium / DAILY_VALUE_MG.magnesium) * 100,
    },
    leftoverGrams,
    missingIngredientIds,
  };
}

/**
 * Suggested mixing order (M4): base ingredients largest first, then flavor
 * ingredients smallest first. Returns a new array; ties keep input order.
 */
export function mixingOrder<T extends { group: IngredientGroup; batchGrams: number }>(lines: T[]): T[] {
  const indexed = lines.map((line, index) => ({ line, index }));
  const base = indexed
    .filter((x) => x.line.group === 'base')
    .sort((a, b) => b.line.batchGrams - a.line.batchGrams || a.index - b.index);
  const flavor = indexed
    .filter((x) => x.line.group !== 'base')
    .sort((a, b) => a.line.batchGrams - b.line.batchGrams || a.index - b.index);
  return [...base, ...flavor].map((x) => x.line);
}
