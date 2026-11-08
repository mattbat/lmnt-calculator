import type { BatchSize, Ingredient, IngredientGroup, Mineral, Recipe, Settings } from '../types';
import { roundToPrecision } from './units';

export const DAILY_VALUE_MG = { sodium: 2300, potassium: 4700 } as const;

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
  vials: number;
  fillGramsPerVial: number;
  totalGrams: number;
  lines: BatchLine[];
  costPerBatch: number;
  costPerServing: number;
  savingsPerServing: number;
  savingsPerBatch: number;
  /** mg per serving. */
  minerals: Record<Mineral, number>;
  /** Percent of daily value per serving. */
  dailyValue: { sodium: number; potassium: number };
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
  servingsPerVial: number,
): { servings: number; vials: number; leftoverGrams: number } {
  const spv = safe(servingsPerVial) || 1;
  const gps = safe(gramsPerServingValue);
  switch (size.mode) {
    case 'servings': {
      const servings = safe(size.servings);
      return { servings, vials: servings / spv, leftoverGrams: 0 };
    }
    case 'vials': {
      const vials = safe(size.vials);
      return { servings: vials * spv, vials, leftoverGrams: 0 };
    }
    case 'weight': {
      const grams = safe(size.grams);
      if (gps === 0) return { servings: 0, vials: 0, leftoverGrams: grams };
      const servings = Math.floor(grams / gps + 1e-9);
      return { servings, vials: servings / spv, leftoverGrams: Math.max(0, grams - servings * gps) };
    }
    default:
      return { servings: 0, vials: 0, leftoverGrams: 0 };
  }
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
  const spv = safe(settings.servingsPerVial) || 1;
  const { servings, vials, leftoverGrams } = resolveServings(size, gps, spv);
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
    vials,
    fillGramsPerVial: gps * spv,
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
