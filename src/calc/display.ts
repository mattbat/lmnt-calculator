import type { Ingredient } from '../types';
import type { BatchResult } from './batch';

/** How a batch is split across vials, with the last vial's partial fill (calculateBatch gives fractional `vials`). */
export interface VialPlan {
  /** Vials to fill, rounded up. */
  totalVials: number;
  /** Servings in the last vial when it is only partly full (0 when every vial is full). */
  partialServings: number;
  /** Grams in that partial vial. */
  partialGrams: number;
}

export function vialPlan(result: Pick<BatchResult, 'servings' | 'vials' | 'fillGramsPerVial'>, servingsPerVial: number): VialPlan {
  const spv = Number.isFinite(servingsPerVial) && servingsPerVial > 0 ? servingsPerVial : 1;
  const totalVials = Math.ceil(result.vials - 1e-9);
  const full = Math.floor(result.vials + 1e-9);
  const partialServings = totalVials > full ? Math.max(0, result.servings - full * spv) : 0;
  const gramsPerServing = result.fillGramsPerVial / spv;
  return { totalVials: Math.max(0, totalVials), partialServings, partialGrams: partialServings * gramsPerServing };
}

/** Price of one gram of an ingredient (0 when the package size is unknown). */
export function pricePerGram(ingredient: Pick<Ingredient, 'packageGrams' | 'packagePrice'>): number {
  return ingredient.packageGrams > 0 ? ingredient.packagePrice / ingredient.packageGrams : 0;
}
