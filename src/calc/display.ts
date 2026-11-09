import type { Ingredient } from '../types';
import type { BatchResult } from './batch';

/** How a batch fills vials, one serving each, with the last vial's partial fill when servings aren't whole. */
export interface FillPlan {
  /** Vials to fill, rounded up. */
  vials: number;
  /** Fraction of a serving in the last vial when it is only partly full (0 when every vial is full). */
  partialServings: number;
  /** Grams in that partial vial. */
  partialGrams: number;
}

export function fillPlan(result: Pick<BatchResult, 'servings' | 'gramsPerServing'>): FillPlan {
  const servings = Number.isFinite(result.servings) && result.servings > 0 ? result.servings : 0;
  const vials = Math.ceil(servings - 1e-9);
  const full = Math.floor(servings + 1e-9);
  const partialServings = vials > full ? servings - full : 0;
  return { vials: Math.max(0, vials), partialServings, partialGrams: partialServings * result.gramsPerServing };
}

/** Price of one gram of an ingredient (0 when the package size is unknown). */
export function pricePerGram(ingredient: Pick<Ingredient, 'packageGrams' | 'packagePrice'>): number {
  return ingredient.packageGrams > 0 ? ingredient.packagePrice / ingredient.packageGrams : 0;
}
